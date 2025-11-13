from __future__ import annotations

import os
import re
import logging
from math import isnan

import duckdb
import numpy as np
import pandas as pd
from django.conf import settings
from django.http import JsonResponse
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny

# ✅ Imports internes
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

# ============================================================
# 🔧 Correction automatique du type de graphique (fallback)
# ============================================================

def auto_fix_chart_spec(question: str, chart_spec: dict, rows: list) -> dict:
    """Corrige ou déduit automatiquement le type de graphique selon la question."""
    q = question.lower().strip()
    if not isinstance(chart_spec, dict):
        chart_spec = {}

    # 🧠 Détection du type si manquant ou 'table'
    if not chart_spec.get("type") or chart_spec.get("type") == "table":
        if any(k in q for k in ["répartition", "proportion", "distribution", "part", "pourcentage", "par nationalité", "par pays"]):
            chart_spec["type"] = "pie"
        elif any(k in q for k in ["évolution", "temps", "mois", "jour", "chronologique", "par semaine", "timeline"]):
            chart_spec["type"] = "line"
        elif any(k in q for k in ["classement", "top", "meilleur", "pire", "comparaison", "plus", "moins"]):
            chart_spec["type"] = "bar"
        elif any(k in q for k in ["corrélation", "relation", "vs", "entre"]):
            chart_spec["type"] = "scatter"
        elif any(k in q for k in ["zone", "aire", "cumul", "progression"]):
            chart_spec["type"] = "area"
        elif any(k in q for k in ["entonnoir", "funnel"]):
            chart_spec["type"] = "funnel"
        elif any(k in q for k in ["radial", "cercle concentrique", "progression circulaire"]):
            chart_spec["type"] = "radial_bar"
        elif any(k in q for k in ["treemap", "hiérarchie", "structure"]):
            chart_spec["type"] = "treemap"
        elif any(k in q for k in ["radar", "compétences", "profil", "polygone"]):
            chart_spec["type"] = "radar"
        elif any(k in q for k in ["empilé", "stacked"]):
            chart_spec["type"] = "stacked_bar"
        else:
            chart_spec["type"] = "table"  # par défaut, renvoyer table si rien n'est graphique


    # 🔒 Sécurisation des clés x/y à partir des données réelles
    if "x" not in chart_spec and rows and isinstance(rows[0], dict):
        chart_spec["x"] = list(rows[0].keys())[0]
    if "y" not in chart_spec and rows and isinstance(rows[0], dict):
        chart_spec["y"] = list(rows[0].keys())[1] if len(rows[0]) > 1 else list(rows[0].keys())[0]

    return chart_spec


logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 🧩 Normalisation des noms
# ---------------------------------------------------------------------------

def _normalize_dataset_name(name: str) -> str:
    """Nettoie un nom de dataset pour qu’il soit compatible avec DuckDB."""
    return re.sub(r"[^A-Za-z0-9]+", "_", (name or "").strip()).strip("_").lower()


def _normalize_column_name(name: str) -> str:
    """Nettoie un nom de colonne pour l’usage SQL."""
    col = re.sub(r"\W+", "_", str(name).strip().lower())
    if re.match(r"^\d", col):
        col = f"col_{col}"
    return col


def _infer_left_var_from_read_csv(code: str) -> str | None:
    """Détecte la variable affectée au read_csv pour réinjection DuckDB."""
    if not code:
        return None
    m = re.search(r"^\s*([A-Za-z_]\w*)\s*=\s*pd\.read_csv\(", code, flags=re.MULTILINE)
    return m.group(1) if m else None


def _inject_duckdb_preamble(code: str, table_name: str, prefer_var: str | None = None) -> str:
    """Injecte le chargement DuckDB dans le code Python généré par le LLM."""
    left_var = _infer_left_var_from_read_csv(code) or prefer_var or "df"
    patched = re.sub(r"pd\.read_csv\([^)]*\)", left_var, code or "", flags=re.MULTILINE)

    preamble = f"""
import duckdb as _ddb
_con = _ddb.connect(r'{settings.DUCKDB_PATH}')
{left_var} = _con.execute('SELECT * FROM "{table_name}"').df()
"""
    return preamble.strip() + "\n\n" + patched.strip()


# ---------------------------------------------------------------------------
# ♻️ Helpers généraux de réponse/validation
# ---------------------------------------------------------------------------


def _json_error(detail: str, *, status: int = 400, code: str | None = None, extra: dict | None = None) -> JsonResponse:
    payload = {"detail": detail}
    if code:
        payload["code"] = code
    if extra:
        payload.update(extra)
    return JsonResponse(payload, status=status)


def _dataset_exists(name: str) -> bool:
    if not name:
        return False
    try:
        result = duckdb.sql(
            "SELECT COUNT(*) FROM information_schema.tables WHERE LOWER(table_name) = LOWER(?)",
            [name],
        ).fetchone()
        return bool(result and result[0])
    except duckdb.Error:
        logger.exception("Impossible de vérifier l'existence du dataset %s", name)
        return False


def _safe_limit(raw_limit: str | int | None, *, default: int = 10, max_value: int = 1000) -> int:
    try:
        limit = int(raw_limit) if raw_limit is not None else default
    except (TypeError, ValueError):
        raise ValueError("Paramètre 'limit' invalide")
    return max(1, min(limit, max_value))


def _to_serializable(value):
    if value is None:
        return None
    if isinstance(value, (np.generic,)):
        return value.item()
    if isinstance(value, (pd.Timestamp, pd.Timedelta)):
        return value.isoformat()
    if isinstance(value, float) and isnan(value):
        return None
    return value


def _frame_to_records(df: pd.DataFrame, *, limit: int | None = None) -> list[dict]:
    sample = df.head(limit) if limit is not None else df
    if sample.empty:
        return []
    serialised = sample.where(pd.notnull(sample), None)
    return [
        {k: _to_serializable(v) for k, v in row.items()}
        for row in serialised.to_dict(orient="records")
    ]


# ---------------------------------------------------------------------------
# 📊 Profilage automatique
# ---------------------------------------------------------------------------

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

    # 🔹 Colonne de date
    date_col = next((c["name"] for c in cols if _is_dt_dtype(c["dtype"])), None)
    if not date_col:
        for p in _DATE_SYNONYMS:
            for c in cols:
                if p in str(c["name"]).lower().replace(" ", "_"):
                    date_col = c["name"]
                    break
            if date_col:
                break

    # 🔹 Colonne numérique
    num_col = next(
        (c["name"] for c in cols if _is_num_dtype(c["dtype"]) and str(c["name"]).lower() not in _ID_LIKE),
        None,
    )
    if not num_col:
        for p in _NUM_SYNONYMS:
            for c in cols:
                if p in str(c["name"]).lower().replace(" ", "_"):
                    num_col = c["name"]
                    break
            if num_col:
                break

    # 🔹 Colonne catégorielle
    cat_col = next(
        (c["name"] for c in cols if not _is_num_dtype(c["dtype"]) and not _is_dt_dtype(c["dtype"])),
        None,
    )

    return date_col, num_col, cat_col


# ---------------------------------------------------------------------------
# 🧠 Génération SQL automatique selon le type de graphique
# ---------------------------------------------------------------------------

def _synth_sql_from_spec(dataset: str, spec: dict) -> tuple[str | None, dict]:
    """Retourne (sql, spec_normalisée). Gère aussi les histogrammes automatiques."""
    if not isinstance(spec, dict):
        return None, spec or {}

    typ = (spec.get("type") or "").lower()
    spec_norm = dict(spec)

    date_col, num_col, cat_col = _infer_columns(dataset)

    def q(col: str) -> str:
        return f'"{col}"'

    # 🔹 Histogramme simple (ex : distribution des valeurs)
    if typ == "histogram":
        x = spec.get("x") or num_col
        if not x:
            return None, spec_norm
        spec_norm.setdefault("bins", 20)
        return f'SELECT {q(x)} FROM "{dataset}" WHERE {q(x)} IS NOT NULL', spec_norm

    # 🔹 Graphique en barres
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

    # 🔹 Série temporelle
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

    # 🔹 Graphique circulaire
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

    # 🔹 Table simple
    if typ == "table":
        return f'SELECT * FROM "{dataset}" LIMIT 1000;', spec_norm

    # 🧠 Nouvelle logique : détection automatique d’histogrammes
    # Si le LLM ne précise pas le type, on tente de deviner à partir du SQL
    if "GROUP BY" in spec.get("sql", "").upper() or "COUNT(" in spec.get("sql", "").upper():
        spec_norm.setdefault("type", "histogram")
        spec_norm.setdefault("x", cat_col or num_col or "x")
        spec_norm.setdefault("y", "count")

    return None, spec_norm


# ---------------------------------------------------------------------------
# 🌐 Endpoints API
# ---------------------------------------------------------------------------

@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
@permission_classes([AllowAny])
def upload_dataset(request):
    """Upload et chargement dans DuckDB."""
    try:
        upfile = request.FILES.get("file")
        if not upfile:
            return _json_error("Champ 'file' requis.")

        dataset = _normalize_dataset_name(request.data.get("dataset") or os.path.splitext(upfile.name)[0])
        ext = (upfile.name or "").lower().rsplit(".", 1)[-1]

        if ext in ("csv", "xlsx", "xls", "json", "parquet"):
            info = load_to_duckdb(upfile, dataset, file_type=ext if ext != "xls" else "excel")
            return JsonResponse({"ok": True, "table": dataset, **info}, status=201)

        return _json_error("Format non supporté (CSV, XLSX, JSON, Parquet).")

    except Exception as e:
        logger.exception("upload_dataset: erreur inattendue")
        return _json_error(f"Echec import: {e}", status=500)


@api_view(["GET"])
@permission_classes([AllowAny])
def datasets_list(request):
    try:
        return JsonResponse({"tables": list_tables()})
    except Exception as e:
        logger.exception("datasets_list: erreur inattendue")
        return _json_error(str(e), status=500)


@api_view(["GET"])
@permission_classes([AllowAny])
def datasets_preview(request, table: str):
    try:
        try:
            limit = _safe_limit(request.GET.get("limit"), default=10)
        except ValueError as exc:
            return _json_error(str(exc))

        if not _dataset_exists(table):
            return _json_error(f"Dataset '{table}' introuvable.", status=404, code="dataset_not_found")

        info = profile_table(table, limit=limit)
        return JsonResponse({"table": table, **info})
    except Exception as e:
        logger.exception("datasets_preview: erreur inattendue")
        return _json_error(str(e), status=500)


@api_view(["GET"])
@permission_classes([AllowAny])
def datasets_insights(request, table: str):
    """Fournit des statistiques descriptives et corrélations clés pour un dataset."""
    try:
        if not _dataset_exists(table):
            return _json_error(f"Dataset '{table}' introuvable.", status=404, code="dataset_not_found")

        try:
            sample_limit = _safe_limit(request.GET.get("sample"), default=500, max_value=5000)
        except ValueError as exc:
            return _json_error(str(exc))

        try:
            df = duckdb.sql(f'SELECT * FROM "{table}" LIMIT {sample_limit}').to_df()
        except duckdb.Error as exc:
            logger.warning("datasets_insights: lecture du dataset %s impossible: %s", table, exc)
            return _json_error(f"Impossible de lire le dataset '{table}'.", status=500)

        if df.empty:
            return JsonResponse(
                {
                    "table": table,
                    "rows_sampled": 0,
                    "fields": {},
                    "summary": [],
                    "missing_values": {},
                    "correlations": [],
                }
            )

        try:
            summary_df = df.describe(include="all", datetime_is_numeric=True)
        except TypeError:
            summary_df = df.describe(include="all")
        summary_df = summary_df.transpose().reset_index()
        summary_df = summary_df.rename(columns={"index": "field"})
        summary = [
            {k: _to_serializable(v) for k, v in row.items()}
            for row in summary_df.where(pd.notnull(summary_df), None).to_dict(orient="records")
        ]

        missing_values = {
            column: _to_serializable(int(count))
            for column, count in df.isna().sum().to_dict().items()
        }

        numeric_df = df.select_dtypes(include=[np.number])
        correlations: list[dict] = []
        if not numeric_df.empty and numeric_df.shape[1] > 1:
            corr_matrix = numeric_df.corr()
            for i, col_i in enumerate(corr_matrix.columns):
                for j in range(i + 1, len(corr_matrix.columns)):
                    value = corr_matrix.iloc[i, j]
                    correlations.append(
                        {
                            "feature_1": col_i,
                            "feature_2": corr_matrix.columns[j],
                            "correlation": _to_serializable(value),
                        }
                    )
            correlations.sort(
                key=lambda item: abs(item["correlation"]) if item["correlation"] is not None else -1,
                reverse=True,
            )

        response = {
            "table": table,
            "rows_sampled": len(df),
            "fields": {col: str(dtype) for col, dtype in df.dtypes.items()},
            "summary": summary,
            "missing_values": missing_values,
            "correlations": correlations[:50],
            "sample": _frame_to_records(df, limit=50),
        }

        return JsonResponse(response)
    except Exception as exc:
        logger.exception("datasets_insights: erreur inattendue")
        return _json_error(f"Erreur interne: {exc}", status=500)


@api_view(["POST"])
@permission_classes([AllowAny])
def query_sql(request):
    """Exécute une requête SQL brute (avec vérification de sécurité)."""
    try:
        sql = (request.data.get("sql") or "").strip()
        if not sql:
            return _json_error("Champ 'sql' requis.")

        if not is_safe(sql):
            return _json_error("Requête SQL non autorisée.")

        rows = run_sql_safe(sql)
        return JsonResponse({"rows": rows})
    except duckdb.CatalogException as exc:
        logger.warning("query_sql: dataset introuvable: %s", exc)
        return _json_error("Dataset introuvable dans la requête.", status=404, code="dataset_not_found")
    except Exception as e:
        logger.exception("query_sql: erreur inattendue")
        return _json_error(str(e), status=500)


# ---------------------------------------------------------------------------
# 🧠 Requêtes NL → SQL via LLM
# ---------------------------------------------------------------------------

def get_schema(dataset: str) -> str:
    """Récupère les noms et types de colonnes DuckDB (pour contextualiser le LLM)."""
    if not dataset:
        return "Aucun dataset spécifié"

    try:
        df = duckdb.query(f"DESCRIBE {dataset};").to_df()
        if df.empty:
            return "Aucune colonne détectée"
        cols = [f"{row['column_name']} ({row['column_type']})" for _, row in df.iterrows()]
        return ", ".join(cols)
    except Exception as e:
        logger.warning(f"Impossible de lire le schéma pour {dataset}: {e}")
        return "Schéma non disponible"


@api_view(["POST"])
@permission_classes([AllowAny])
def query_nl(request):
    """
    Interprète une question naturelle via le LLM (n8n si dispo),
    puis exécute la requête SQL générée de manière sécurisée.
    """
    try:
        data = request.data or {}
        question = (data.get("question") or "").strip()
        dataset = _normalize_dataset_name(data.get("dataset"))

        if not question or not dataset:
            return _json_error("Champs 'question' et 'dataset' requis.")

        if not _dataset_exists(dataset):
            return _json_error(f"Dataset '{dataset}' introuvable.", status=404, code="dataset_not_found")

        schema = get_schema(dataset)
        extra = {k: v for k, v in data.items() if k not in {"question", "dataset"}}
        extra.update({"schema": schema})

        payload = {}
        if n8n_is_configured():
            try:
                payload = n8n_nl_to_sql(question, dataset, extra=extra)
            except Exception as e:
                logger.warning(f"Erreur n8n: {e}")

        # --------------------- Cas : code Python généré ---------------------
        if payload.get("code_python"):
            code = _inject_duckdb_preamble(payload["code_python"], dataset, prefer_var=dataset)
            result = run_pandas_analysis(code)
            return JsonResponse({
                "rows": result.get("rows", []),
                "chart_spec": payload.get("chart_spec", {"type": "custom"}),
                "summary": payload.get("summary", ""),
                "sql": payload.get("sql"),
                "schema": schema,
            })

        # --------------------- Cas : SQL généré ----------------------------
        chart_spec = payload.get("chart_spec", {})
        sql = (payload.get("sql") or "").strip()

        # Génération automatique selon le type de graphique
        if not sql and chart_spec:
            sql, chart_spec = _synth_sql_from_spec(dataset, chart_spec)

        # Fallback : génération d’un SQL par défaut
        if not sql:
            date_col, val_col, cat_col = _infer_columns(dataset)
            plan = {
                "intent": data.get("intent", "timeseries_total"),
                "dataset": dataset,
                "date_col": date_col,
                "amount_col": val_col,
                "category_col": cat_col,
                "limit": int(data.get("limit", 1000)),
            }
            sql = build_sql_from_plan(plan)
            chart_spec = {"type": "table"}

        # Validation sécurité
        if not sql or not is_safe(sql):
            return _json_error("SQL généré invalide ou non autorisé.")

        # Exécution
        try:
            rows = run_sql_safe(sql)
        except Exception as e:
            logger.error(f"Erreur exécution SQL ({dataset}): {e}")
            return _json_error(f"Exécution SQL échouée: {e}")

                # --------------------------- RÉPONSE FINALE ----------------------------
        # 🔹 Détection automatique d'histogramme pour les GROUP BY COUNT
        if not chart_spec and "count(" in sql.lower() and "group by" in sql.lower():
            # Cherche les noms de colonnes de sortie
            first_row = rows[0] if rows else {}
            keys = list(first_row.keys()) if first_row else []
            if len(keys) >= 2:
                chart_spec = {
                    "type": "histogram",
                    "x": keys[0],
                    "y": keys[1],
                }
            else:
                chart_spec = {"type": "histogram"}

        # 🧩 Correction automatique du type de graphique avant réponse
        chart_spec = auto_fix_chart_spec(question, chart_spec, rows)
        print("📊 chart_spec final envoyé au frontend :", chart_spec)

        return JsonResponse({
            "rows": rows,
            "chart_spec": chart_spec,
            "summary": payload.get("summary", ""),
            "sql": sql,
            "schema": schema,
        })



    except Exception as e:
        logger.exception("query_nl: erreur inattendue")
        return _json_error(f"Erreur interne: {e}", status=500)
