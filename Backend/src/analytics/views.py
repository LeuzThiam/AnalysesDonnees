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

# ✅ Imports internes
from .duck import (
    load_to_duckdb,
    list_tables,
    profile_table,
    run_sql,
    auto_analyze,
    query,
)
from .services.guards import is_safe
from .services.runners import run_sql_safe
from .services.planner import build_sql_from_plan
from integrations.n8n import nl_to_sql as n8n_nl_to_sql, is_configured as n8n_is_configured
from integrations.n8n_analysis import analyze_result, is_configured as analysis_is_configured

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
            return JsonResponse({"detail": "Champ 'file' requis."}, status=400)

        dataset = _normalize_dataset_name(request.data.get("dataset") or os.path.splitext(upfile.name)[0])
        ext = (upfile.name or "").lower().rsplit(".", 1)[-1]

        if ext in ("csv", "xlsx", "xls", "json", "parquet"):
            info = load_to_duckdb(upfile, dataset, file_type=ext if ext != "xls" else "excel")
            return JsonResponse({"ok": True, "table": dataset, **info}, status=201)

        return JsonResponse({"detail": "Format non supporté (CSV, XLSX, JSON, Parquet)."}, status=400)

    except Exception as e:
        logger.exception("upload_dataset: erreur inattendue")
        return JsonResponse({"detail": f"Echec import: {e}"}, status=500)


@api_view(["GET"])
@permission_classes([AllowAny])
def datasets_list(request):
    try:
        return JsonResponse({"tables": list_tables()})
    except Exception as e:
        logger.exception("datasets_list: erreur inattendue")
        return JsonResponse({"detail": str(e)}, status=500)


@api_view(["GET"])
@permission_classes([AllowAny])
def datasets_preview(request, table: str):
    try:
        limit = max(1, min(int(request.GET.get("limit", 10)), 1000))
        info = profile_table(table, limit=limit)
        return JsonResponse({"table": table, **info})
    except Exception as e:
        logger.exception("datasets_preview: erreur inattendue")
        return JsonResponse({"detail": str(e)}, status=500)


@api_view(["POST"])
@permission_classes([AllowAny])
def query_sql(request):
    """Exécute une requête SQL brute (avec vérification de sécurité)."""
    try:
        sql = (request.data.get("sql") or "").strip()
        if not sql:
            return JsonResponse({"detail": "Champ 'sql' requis."}, status=400)

        if not is_safe(sql):
            return JsonResponse({"detail": "Requête SQL non autorisée."}, status=400)

        rows = run_sql_safe(sql)
        return JsonResponse({"rows": rows})
    except Exception as e:
        logger.exception("query_sql: erreur inattendue")
        return JsonResponse({"detail": str(e)}, status=500)


# ---------------------------------------------------------------------------
# 🧠 Requêtes NL → SQL via LLM
# ---------------------------------------------------------------------------

def get_schema(dataset: str) -> str:
    """Récupère les noms et types de colonnes DuckDB (pour contextualiser le LLM)."""
    if not dataset:
        return "Aucun dataset spécifié"

    try:
        df = query(f'DESCRIBE "{dataset}";')
        if df.empty:
            return "Aucune colonne détectée"
        cols = [f"{row['column_name']} ({row['column_type']})" for _, row in df.iterrows()]
        return ", ".join(cols)
    except Exception as e:
        logger.warning(f"Impossible de lire le schéma pour {dataset}: {e}")
        return "Schéma non disponible"
    

import numpy as np

def auto_analyze_result(rows: list[dict], chart_spec: dict, question: str) -> str:
    """
    Génère une interprétation automatique simple selon les résultats.
    """
    if not rows or not isinstance(rows, list) or len(rows) == 0:
        return "Aucune donnée à analyser."

    # On essaie d’identifier les colonnes numériques et catégorielles
    first_row = rows[0]
    keys = list(first_row.keys())
    if len(keys) < 2:
        return "Résultat trop simple pour une analyse automatique."

    x_key = chart_spec.get("x", keys[0])
    y_key = chart_spec.get("y", keys[1])
    try:
        y_values = [float(r[y_key]) for r in rows if r.get(y_key) is not None]
    except Exception:
        return "Impossible d’interpréter les valeurs numériques."

    # Statistiques de base
    n = len(y_values)
    mean_val = np.mean(y_values)
    median_val = np.median(y_values)
    min_val = np.min(y_values)
    max_val = np.max(y_values)
    amplitude = max_val - min_val

    # Génération d’une analyse textuelle
    analysis = []

    # Type détecté
    typ = (chart_spec.get("type") or "").lower()

    if typ in ["line", "timeseries", "area"]:
        analysis.append(f"Les données présentent une évolution sur {n} points.")
        if y_values[-1] > y_values[0]:
            analysis.append("La tendance générale est à la hausse 📈.")
        elif y_values[-1] < y_values[0]:
            analysis.append("La tendance générale est à la baisse 📉.")
        else:
            analysis.append("La tendance reste stable sur la période.")
    elif typ in ["bar", "pie", "histogram", "stacked_bar"]:
        max_row = max(rows, key=lambda r: r[y_key])
        min_row = min(rows, key=lambda r: r[y_key])
        analysis.append(f"La catégorie '{max_row[x_key]}' a la valeur la plus élevée ({max_row[y_key]:.2f}).")
        analysis.append(f"La catégorie '{min_row[x_key]}' est la plus faible ({min_row[y_key]:.2f}).")
        if amplitude / mean_val > 0.5:
            analysis.append("La variation entre catégories est importante.")
        else:
            analysis.append("Les valeurs sont relativement homogènes entre catégories.")
    else:
        analysis.append("Les résultats sont affichés sous forme tabulaire. Consultez les valeurs clés ci-dessus.")

    analysis.append(f"Valeur moyenne : {mean_val:.2f}, médiane : {median_val:.2f}, min : {min_val:.2f}, max : {max_val:.2f}.")
    return " ".join(analysis)





@api_view(["POST"])
@permission_classes([AllowAny])
def query_nl(request):
    """
    NL → (n8n) → SQL/plan → exécution sécurisée → (optionnel) analyse experte n8n
    avec fallback local si n8n indisponible.
    """
    try:
        data = request.data or {}
        question = (data.get("question") or "").strip()
        dataset = _normalize_dataset_name(data.get("dataset"))

        if not question or not dataset:
            return JsonResponse({"detail": "Champs 'question' et 'dataset' requis."}, status=400)

        # 1) Schéma pour contextualiser
        schema = get_schema(dataset)
        extra = {k: v for k, v in data.items() if k not in {"question", "dataset"}}
        extra.update({"schema": schema})

        # 2) NL→SQL via n8n (si dispo)
        payload = {}
        if n8n_is_configured():
            try:
                payload = n8n_nl_to_sql(question, dataset, extra=extra)
            except Exception as e:
                logger.warning(f"Erreur n8n (NL→SQL): {e}")

        # 3) Cas code Python généré
        if payload.get("code_python"):
            code = _inject_duckdb_preamble(payload["code_python"], dataset, prefer_var=dataset)
            result = run_pandas_analysis(code)
            rows = result.get("rows", [])
            chart_spec = payload.get("chart_spec", {"type": "custom"})
            analysis_text = ""
            if analysis_is_configured():
                try:
                    n8n_out = analyze_result(question, rows, chart_spec)
                    analysis_text = n8n_out.get("summary") or n8n_out.get("text") or ""
                except Exception as e:
                    logger.warning(f"Analyse n8n échouée: {e}")
            base_summary = payload.get("summary") or ""
            combined_summary = base_summary
            if analysis_text:
                prefix = "\n\n💡 Analyse experte : " if combined_summary else "💡 Analyse experte : "
                combined_summary = (combined_summary + prefix + analysis_text).strip()
            return JsonResponse({
                "rows": rows,
                "chart_spec": chart_spec,
                "summary": combined_summary,
                "sql": payload.get("sql"),
                "schema": schema,
            })

        # 4) Cas SQL généré (ou synthèse depuis chart_spec / plan)
        chart_spec = payload.get("chart_spec", {}) or {}
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
                "limit": int(data.get("limit", 1000)),
            }
            sql = build_sql_from_plan(plan)
            chart_spec = {"type": "table"}

        # 5) Sécurité puis exécution
        if not sql or not is_safe(sql):
            return JsonResponse({"detail": "SQL généré invalide ou non autorisé."}, status=400)

        try:
            rows = run_sql_safe(sql)
        except Exception as e:
            logger.error(f"Erreur exécution SQL ({dataset}): {e}")
            return JsonResponse({"detail": f"Exécution SQL échouée: {e}"}, status=400)

        # 6) Fix chart + analyse locale / n8n
        chart_spec = auto_fix_chart_spec(question, chart_spec, rows)

        analysis_text = ""
        if analysis_is_configured():
            try:
                n8n_out = analyze_result(question, rows, chart_spec)
                analysis_text = n8n_out.get("summary") or n8n_out.get("text") or ""
            except Exception as e:
                logger.warning(f"Analyse n8n échouée: {e}")

        combined_summary = payload.get("summary") or ""
        if analysis_text:
            prefix = "\n\n💡 Analyse experte : " if combined_summary else "💡 Analyse experte : "
            combined_summary = (combined_summary + prefix + analysis_text).strip()

        return JsonResponse({
            "rows": rows,
            "chart_spec": chart_spec,
            "summary": combined_summary,
            "sql": sql,
            "schema": schema,
        })

    except Exception as e:
        logger.exception("query_nl: erreur inattendue")
        return JsonResponse({"detail": f"Erreur interne: {e}"}, status=500)