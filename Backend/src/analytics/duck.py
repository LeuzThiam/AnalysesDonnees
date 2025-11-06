# Backend/src/analytics/duck.py
from __future__ import annotations
import os, io, re, json, warnings
from typing import List, Dict, Any

import duckdb
import numpy as np
import pandas as pd
from pandas.api.types import is_datetime64_any_dtype, is_numeric_dtype

warnings.filterwarnings("ignore", category=UserWarning, module="duckdb")

# ============================================================
# ⚙️ CONFIGURATION DU MOTEUR
# ============================================================
DB_PATH = os.getenv("DUCKDB_PATH", os.path.join("data", "insight.duckdb"))
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
_con = duckdb.connect(DB_PATH)
_normalize_cols = str(os.getenv("NORMALIZE_COLS", "0")).lower() in {"1", "true", "yes"}


# ============================================================
# 🧩 UTILITAIRES GÉNÉRIQUES
# ============================================================
def _id(name: str) -> str:
    """Quote un identifiant SQL (gère espaces, majuscules, caractères spéciaux)."""
    if not name:
        raise ValueError("Identifiant vide")
    if re.search(r"[^0-9a-zA-Z_]", name):
        safe = name.replace('"', '""')
        return f'"{safe}"'
    return name


def _jsonify_df(df: pd.DataFrame) -> list[dict]:
    """Convertit un DataFrame en liste de dictionnaires JSON-compatibles."""
    if df is None or df.empty:
        return []
    df = df.where(pd.notna(df), None)
    for c in df.columns:
        if is_datetime64_any_dtype(df[c]):
            df[c] = df[c].dt.strftime("%Y-%m-%d %H:%M:%S")
    def native(v): return v.item() if isinstance(v, np.generic) else v
    return [{k: native(v) for k, v in r.items()} for r in df.to_dict("records")]


# ============================================================
# 📁 LECTURE INTELLIGENTE DES FICHIERS
# ============================================================
def _read_smart_csv(buf) -> pd.DataFrame:
    """Lecture CSV robuste avec détection automatique du séparateur et de l'encodage."""
    try:
        return pd.read_csv(buf, sep=None, engine="python")
    except UnicodeDecodeError:
        if isinstance(buf, (str, os.PathLike)):
            return pd.read_csv(buf, sep=None, engine="python", encoding="latin-1")
        data = buf.getvalue() if hasattr(buf, "getvalue") else buf.read()
        return pd.read_csv(io.BytesIO(data), sep=None, engine="python", encoding="latin-1")


def _normalize(df: pd.DataFrame) -> pd.DataFrame:
    """Normalise les noms de colonnes : minuscules, underscores, pas d'espaces."""
    if not _normalize_cols:
        return df
    df = df.copy()
    df.columns = (
        df.columns.astype(str)
        .str.strip().str.lower()
        .str.replace(r"[^0-9a-zA-Z]+", "_", regex=True)
        .str.replace(r"_+", "_", regex=True)
        .str.strip("_")
    )
    return df


def _ensure_df(path_or_file, file_type: str = "csv") -> pd.DataFrame:
    """Accepte chemin, fichier binaire, ou buffer, et renvoie un DataFrame."""
    if isinstance(path_or_file, (str, os.PathLike)):
        if file_type == "excel": return _normalize(pd.read_excel(path_or_file))
        if file_type == "json": return _normalize(pd.read_json(path_or_file))
        if file_type == "parquet": return _normalize(pd.read_parquet(path_or_file))
        return _normalize(_read_smart_csv(path_or_file))
    if hasattr(path_or_file, "read"):
        data = path_or_file.read()
        if hasattr(path_or_file, "seek"): path_or_file.seek(0)
        if file_type == "excel": return _normalize(pd.read_excel(io.BytesIO(data)))
        if file_type == "json": return _normalize(pd.read_json(io.BytesIO(data)))
        if file_type == "parquet": return _normalize(pd.read_parquet(io.BytesIO(data)))
        return _normalize(_read_smart_csv(io.BytesIO(data)))
    return _normalize(_read_smart_csv(path_or_file))


# ============================================================
# 🏗️ INGESTION DES DONNÉES DANS DUCKDB
# ============================================================
def _create_or_replace_table(df: pd.DataFrame, table: str):
    _con.execute(f"DROP TABLE IF EXISTS {_id(table)};")
    _con.register("tmp_df", df)
    _con.execute(f"CREATE TABLE {_id(table)} AS SELECT * FROM tmp_df;")
    _con.unregister("tmp_df")


def load_to_duckdb(path_or_file, table: str, file_type="csv") -> dict:
    """Charge un fichier (CSV, Excel, JSON, Parquet) en table DuckDB."""
    df = _ensure_df(path_or_file, file_type)
    _create_or_replace_table(df, table)
    return {
        "count": len(df),
        "columns": [{"name": c, "dtype": str(t)} for c, t in df.dtypes.items()],
        "preview": _jsonify_df(df.head(10)),
    }


# ============================================================
# 🔍 EXPLORATION DES DONNÉES
# ============================================================
def list_tables() -> list[str]:
    return [r[0] for r in _con.execute("SHOW TABLES;").fetchall()]


def profile_table(table: str, limit: int = 10) -> dict:
    """Retourne le schéma + un échantillon + des stats descriptives."""
    df = _con.execute(f"SELECT * FROM {_id(table)} LIMIT {limit};").fetchdf()
    desc = _con.execute(f"SELECT * FROM {_id(table)}").fetchdf().describe().T.reset_index()
    return {
        "columns": [{"name": c, "dtype": str(t)} for c, t in df.dtypes.items()],
        "rows": _jsonify_df(df),
        "stats": _jsonify_df(desc)
    }


# ============================================================
# 🧠 EXÉCUTION SQL INTELLIGENTE
# ============================================================
def run_sql(sql: str) -> pd.DataFrame:
    """
    Exécute du SQL DuckDB avec :
    - correction automatique des guillemets et backslashes
    - conversion automatique pour date_trunc(VARCHAR)
    - détection des erreurs courantes
    """
    sql = sql.strip().replace("\\", "")
    sql = re.sub(
        r"date_trunc\((['\"]\w+['\"]),\s*([a-zA-Z_][a-zA-Z0-9_]*)\)",
        r"date_trunc(\1, try_cast(\2 AS DATE))",
        sql,
        flags=re.IGNORECASE,
    )
    sql = re.sub(r";+", ";", sql)
    print(f"🧠 Requête corrigée : {sql}")
    try:
        return _con.execute(sql).fetchdf()
    except Exception as e:
        raise RuntimeError(f"Erreur d'exécution SQL : {e}\nRequête : {sql}")


# ============================================================
# 📊 ANALYSE AUTOMATIQUE (bonus)
# ============================================================
def auto_analyze(table: str) -> dict:
    """
    Génère une analyse descriptive complète :
    - Types de colonnes
    - Valeurs manquantes
    - Moyenne, écart-type, min, max pour les numériques
    - Répartition des catégories
    """
    df = _con.execute(f"SELECT * FROM {_id(table)}").fetchdf()
    info = []
    for col in df.columns:
        col_data = df[col]
        stats = {
            "colonne": col,
            "dtype": str(col_data.dtype),
            "nb_valeurs": int(col_data.count()),
            "nb_manquants": int(col_data.isna().sum())
        }
        if is_numeric_dtype(col_data):
            stats.update({
                "moyenne": float(col_data.mean()),
                "ecart_type": float(col_data.std()),
                "min": float(col_data.min()),
                "max": float(col_data.max())
            })
        elif col_data.nunique() <= 20:
            freq = col_data.value_counts(normalize=True).head(5).to_dict()
            stats["top_categories"] = {str(k): round(v * 100, 2) for k, v in freq.items()}
        info.append(stats)
    return {"profil": info}
