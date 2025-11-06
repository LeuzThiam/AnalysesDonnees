"""
Runners: exécution des requêtes SQL (DuckDB) ou analyses Python (Pandas/Numpy/Scikit-learn),
avec garde-fous (LIMIT/SAMPLE) et sortie JSON-safe.
Expose aussi des helpers de profilage.
"""

from __future__ import annotations
from typing import Any, Dict, Optional, List, Union

import numpy as np
import pandas as pd
import io, base64
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import IsolationForest

from .guards import is_safe, add_limit_if_missing, wrap_sample
from ..duck import run_sql as _run_sql, profile_table as _profile_table


class QueryError(Exception):
    pass


# ------------------ Helpers ------------------ #

def _jsonify_df(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Convertit un DataFrame en liste de dicts JSON-sérialisables."""
    if df is None or df.empty:
        return []
    df = df.where(pd.notna(df), None)
    for c in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[c]):
            df[c] = df[c].dt.strftime("%Y-%m-%d %H:%M:%S")

    def native(v):
        if isinstance(v, np.generic):
            return v.item()
        return v

    return [{k: native(v) for k, v in row.items()} for row in df.to_dict("records")]


# ------------------ SQL Runner ------------------ #

def run_sql_safe(
    sql: str,
    add_limit: Optional[int] = 1000,
    sample_perc: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """Valide et exécute du SQL, renvoie une liste de dicts JSON-safe."""
    if not is_safe(sql):
        raise QueryError("Requête SQL non autorisée.")

    safe_sql = sql
    if sample_perc:
        safe_sql = wrap_sample(safe_sql, sample_perc)
        # même avec échantillonnage, on garde un LIMIT haut pour éviter l'explosion
        safe_sql = add_limit_if_missing(safe_sql, add_limit or 5000)
    else:
        safe_sql = add_limit_if_missing(safe_sql, add_limit)

    try:
        df = _run_sql(safe_sql)  # DataFrame
        return _jsonify_df(df)
    except Exception as e:
        raise QueryError(f"Echec de l'exécution SQL: {e}") from e


# ------------------ Pandas Runner ------------------ #

def run_pandas_safe(dataset_path: str, code: str) -> Dict[str, Any]:
    """
    Exécute du code Pandas/Numpy/Scikit-learn généré par le LLM.
    Retourne toujours un dict JSON-safe (rows, chart, result, error).
    """
    # Charger dataset
    if dataset_path.endswith(".csv"):
        df = pd.read_csv(dataset_path)
    elif dataset_path.endswith(".xlsx"):
        df = pd.read_excel(dataset_path)
    else:
        raise QueryError("Format non supporté")

    env = {
        "pd": pd,
        "np": np,
        "df": df,
        "sns": sns,
        "plt": plt,
        "LinearRegression": LinearRegression,
        "IsolationForest": IsolationForest,
    }

    try:
        # ⚠️ Attention: eval = dangereux (à sandboxer idéalement)
        result = eval(code, {"__builtins__": {}}, env)

        # DataFrame → JSON
        if isinstance(result, (pd.DataFrame, pd.Series)):
            return {"rows": _jsonify_df(result)}

        # Graphique → image base64
        if plt.get_fignums():
            buf = io.BytesIO()
            plt.savefig(buf, format="png")
            buf.seek(0)
            img_b64 = base64.b64encode(buf.read()).decode("utf-8")
            plt.close("all")
            return {"chart": img_b64}

        return {"result": str(result)}

    except Exception as e:
        return {"error": str(e)}


# ------------------ Profilage ------------------ #

def preview_table(table: str, limit: int = 50) -> Dict[str, Any]:
    """Preview (schéma + lignes) via duck.profile_table."""
    return _profile_table(table, limit=limit)


def profile_table(table: str) -> Dict[str, Any]:
    """Alias de profilage (par compat)."""
    try:
        return _profile_table(table)
    except Exception as e:
        raise QueryError(f"Echec du profilage de la table '{table}': {e}") from e


# ------------------ Unified Runner ------------------ #

def run_analysis(
    plan: Dict[str, Any],
    dataset_path: Optional[str] = None
) -> Union[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Décide automatiquement entre SQL ou Pandas selon le plan fourni par le LLM.
    """
    if plan.get("sql"):
        return run_sql_safe(plan["sql"])
    elif plan.get("code_python"):
        if not dataset_path:
            raise QueryError("Dataset path requis pour Pandas")
        return run_pandas_safe(dataset_path, plan["code_python"])
    else:
        raise QueryError("Plan invalide: ni SQL ni code Python fourni")
