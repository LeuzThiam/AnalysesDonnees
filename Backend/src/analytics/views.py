from __future__ import annotations

import os
import re
import logging
import pandas as pd
from django.conf import settings
from django.http import JsonResponse
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny

# ✅ nouveaux imports (remplace les anciens)
from .duck import (
    load_to_duckdb,
    list_tables,
    profile_table,
    run_sql,
    auto_analyze,
)
from .services.guards import is_safe
from .services.runners import run_sql_safe
from .services.planner import build_sql_from_plan
from integrations.n8n import nl_to_sql as n8n_nl_to_sql, is_configured as n8n_is_configured
from .services.pandas_runner import run_pandas_analysis

logger = logging.getLogger(__name__)

# ----------------------------- Normalisations -----------------------------
def _normalize_dataset_name(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", (name or "").strip()).strip("_").lower()


def _normalize_column_name(name: str) -> str:
    col = re.sub(r"\W+", "_", str(name).strip().lower())
    if re.match(r"^\d", col):
        col = f"col_{col}"
    return col


def _infer_left_var_from_read_csv(code: str) -> str | None:
    if not code:
        return None
    m = re.search(r"^\s*([A-Za-z_]\w*)\s*=\s*pd\.read_csv\(", code, flags=re.MULTILINE)
    return m.group(1) if m else None


def _inject_duckdb_preamble(code: str, table_name: str, prefer_var: str | None = None) -> str:
    left_var = _infer_left_var_from_read_csv(code) or prefer_var or "df"
    patched = code or ""
    patched = re.sub(
        r"(\b[A-Za-z_]\w*\b\s*=\s*)pd\.read_csv\([^)]*\)",
        rf"\1{left_var}  # remplacé: lecture via DuckDB",
        patched,
        flags=re.MULTILINE,
    )
    patched = re.sub(r"pd\.read_csv\([^)]*\)", left_var, patched, flags=re.MULTILINE)

    preamble = f"""
import duckdb as _ddb
_con = _ddb.connect(r'{settings.DUCKDB_PATH}')
{left_var} = _con.execute('SELECT * FROM "{table_name}"').df()
"""
    return preamble + "\n" + patched


# ----------------------- Profilage / inférence -----------------------------
_DATE_SYNONYMS = ("date", "jour", "day", "time", "timestamp", "datetime", "created", "due")
_NUM_SYNONYMS = ("cases", "cas", "total_cases", "value", "amount", "sum", "count", "nb", "y")
_ID_LIKE = {"id", "task id", "task_id"}


def _duck_profile(dataset: str) -> dict:
    return profile_table(dataset, limit=50) or {}


def _is_num_dtype(dt: str) -> bool:
    s = str(dt).lower()
    return any(k in s for k in ("int", "float", "double", "decimal", "numeric"))


def _is_dt_dtype(dt: str) -> bool:
    s = str(dt).lower()
    return any(k in s for k in ("date", "time", "timestamp", "datetime"))


def _infer_columns(dataset: str):
    """Retourne (date_col, num_col, cat_col) à partir du profil."""
    info = _duck_profile(dataset)
    cols = info.get("columns", [])

    date_col = next((c["name"] for c in cols if _is_dt_dtype(c["dtype"])), None)
    if not date_col:
        for p in _DATE_SYNONYMS:
            for c in cols:
                nm = str(c["name"]).lower().replace(" ", "_")
                if p in nm:
                    date_col = c["name"]
                    break
            if date_col:
                break

    num_col = None
    for c in cols:
        if _is_num_dtype(c["dtype"]):
            nm = str(c["name"]).lower()
            if nm not in _ID_LIKE:
                num_col = c["name"]
                break

    cat_col = next((c["name"] for c in cols if not _is_num_dtype(c["dtype"]) and not _is_dt_dtype(c["dtype"])), None)

    # bonus: si pas de num_col, essayer par nom
    if not num_col:
        for p in _NUM_SYNONYMS:
            for c in cols:
                nm = str(c["name"]).lower().replace(" ", "_")
                if p in nm:
                    num_col = c["name"]
                    break
            if num_col:
                break

    return date_col, num_col, cat_col


# ---------------------- Génération SQL à partir du chart_spec ----------------
def _synth_sql_from_spec(dataset: str, spec: dict) -> tuple[str | None, dict]:
    """Retourne (sql, spec_normalisée)."""
    if not isinstance(spec, dict):
        return None, spec or {}

    typ = (spec.get("type") or "").lower()
    spec_norm = dict(spec)

    date_col, num_col, cat_col = _infer_columns(dataset)

    def q(col: str) -> str:
        return f'"{col}"'

    if typ == "histogram":
        x = spec.get("x") or num_col
        if not x:
            return None, spec_norm
        spec_norm.setdefault("bins", 20)
        return f'SELECT {q(x)} FROM "{dataset}" WHERE {q(x)} IS NOT NULL', spec_norm

    if typ in ("bar", "bar_horizontal"):
        x = spec.get("x") or cat_col
        y = spec.get("y") or num_col
        if not (x and y):
            return None, spec_norm
        sql = f'''
SELECT {q(x)} AS label, SUM(CAST({q(y)} AS DOUBLE)) AS value
FROM "{dataset}"
WHERE {q(x)} IS NOT NULL AND {q(y)} IS NOT NULL
GROUP BY 1
ORDER BY 2 DESC;
'''
        return sql.strip(), spec_norm

    if typ in ("line", "timeseries"):
        x = spec.get("x") or date_col
        y = spec.get("y") or num_col
        if not (x and y):
            return None, spec_norm
        sql = f'''
SELECT CAST({q(x)} AS TIMESTAMP) AS dt, SUM(CAST({q(y)} AS DOUBLE)) AS value
FROM "{dataset}"
WHERE {q(x)} IS NOT NULL AND {q(y)} IS NOT NULL
GROUP BY 1
ORDER BY 1;
'''
        return sql.strip(), spec_norm

    if typ == "pie":
        label = spec.get("label") or cat_col
        value = spec.get("value") or num_col
        if not (label and value):
            return None, spec_norm
        sql = f'''
SELECT {q(label)} AS name, SUM(CAST({q(value)} AS DOUBLE)) AS value
FROM "{dataset}"
WHERE {q(label)} IS NOT NULL AND {q(value)} IS NOT NULL
GROUP BY 1
ORDER BY 2 DESC;
'''
        return sql.strip(), spec_norm

    if typ == "table":
        return f'SELECT * FROM "{dataset}" LIMIT 1000;', spec_norm

    return None, spec_norm


# -------------------------------- Endpoints --------------------------------
@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
@permission_classes([AllowAny])
def upload_dataset(request):
    """
    Charge un dataset (CSV, XLSX, JSON, Parquet) dans DuckDB.
    """
    try:
        upfile = request.FILES.get("file")
        if not upfile:
            return JsonResponse({"detail": "Champ 'file' requis."}, status=400)

        dataset = _normalize_dataset_name(request.data.get("dataset") or os.path.splitext(upfile.name)[0])
        ext = (upfile.name or "").lower().rsplit(".", 1)[-1]

        if ext in ("csv", "xlsx", "xls", "json", "parquet"):
            info = load_to_duckdb(upfile, dataset, file_type=ext if ext != "xls" else "excel")
            return JsonResponse({"ok": True, "table": dataset, **info}, status=201)
        else:
            return JsonResponse({"detail": "Format non supporté (CSV, XLSX, JSON, Parquet)."}, status=400)

    except Exception as e:
        logger.exception("upload_dataset: erreur inattendue")
        return JsonResponse({"detail": f"Echec import: {e}"}, status=500)


@api_view(["GET"])
@permission_classes([AllowAny])
def datasets_list(request):
    try:
        tables = list_tables()
        return JsonResponse({"tables": tables})
    except Exception as e:
        logger.exception("datasets_list: erreur inattendue")
        return JsonResponse({"detail": str(e)}, status=500)


@api_view(["GET"])
@permission_classes([AllowAny])
def datasets_preview(request, table: str):
    try:
        limit = int(request.GET.get("limit", 10))
        limit = max(1, min(limit, 1000))
        info = profile_table(table, limit=limit)
        return JsonResponse({"table": table, **info})
    except Exception as e:
        logger.exception("datasets_preview: erreur inattendue")
        return JsonResponse({"detail": str(e)}, status=500)


@api_view(["POST"])
@permission_classes([AllowAny])
def query_sql(request):
    try:
        sql = (request.data.get("sql") or "").strip()
        if not sql:
            return JsonResponse({"detail": "Champ 'sql' requis."}, status=400)

        rows = run_sql_safe(sql)
        return JsonResponse({"rows": rows})
    except Exception as e:
        logger.exception("query_sql: erreur inattendue")
        return JsonResponse({"detail": str(e)}, status=500)


@api_view(["POST"])
@permission_classes([AllowAny])
def query_nl(request):
    """
    Interprète une question naturelle via n8n ou fallback interne.
    """
    try:
        data = request.data or {}
        question = (data.get("question") or "").strip()
        dataset = _normalize_dataset_name(data.get("dataset"))
        if not question or not dataset:
            return JsonResponse({"detail": "Champs 'question' et 'dataset' requis."}, status=400)

        payload = {}
        if n8n_is_configured():
            try:
                payload = n8n_nl_to_sql(question, dataset, extra={k: v for k, v in data.items() if k not in {"question", "dataset"}})
            except Exception as e:
                logger.warning(f"n8n error: {e}")

        # Exécution Python si fourni
        if payload.get("code_python"):
            code = _inject_duckdb_preamble(payload["code_python"], dataset, prefer_var=dataset)
            result = run_pandas_analysis(code)
            return JsonResponse({
                "rows": result.get("rows", []),
                "chart_spec": payload.get("chart_spec", {"type": "custom"}),
                "summary": payload.get("summary", ""),
                "sql": payload.get("sql")
            })

        # SQL direct ou dérivé
        chart_spec = payload.get("chart_spec", {})
        sql = (payload.get("sql") or "").strip()

        if not sql and chart_spec:
            sql, chart_spec = _synth_sql_from_spec(dataset, chart_spec)

        if not sql:
            date_col, val_col, cat_col = _infer_columns(dataset)
            plan = {
                "intent": data.get("intent", "timeseries_total"),
                "dataset": dataset,
                "date_col": date_col,
                "amount_col": val_col,
                "category_col": cat_col,
                "limit": int(data.get("limit", 1000))
            }
            sql = build_sql_from_plan(plan)
            chart_spec = {"type": "table"}

        if not is_safe(sql):
            return JsonResponse({"detail": "SQL généré invalide."}, status=400)

        try:
            rows = run_sql_safe(sql)
        except Exception as e:
            return JsonResponse({"detail": f"Exécution SQL échouée: {e}"}, status=400)

        return JsonResponse({
            "rows": rows,
            "chart_spec": chart_spec or {"type": "table"},
            "summary": payload.get("summary", ""),
            "sql": sql
        })
    except Exception as e:
        logger.exception("query_nl: erreur inattendue")
        return JsonResponse({"detail": f"Erreur interne: {e}"}, status=500)
