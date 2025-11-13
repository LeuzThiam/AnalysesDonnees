import io
import base64
import contextlib
from typing import Optional, Any, Dict

# ⚠️ IMPORTANT: forcer un backend headless
import matplotlib
matplotlib.use("Agg")  # <— ajoute ça AVANT pyplot
import matplotlib.pyplot as plt

import pandas as pd
import numpy as np
import seaborn as sns
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import IsolationForest


def _render_chart_to_base64() -> str:
    buf = io.BytesIO()
    plt.savefig(buf, format="png", bbox_inches="tight")
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def _fallback_plot_from_spec(df: pd.DataFrame, spec: Dict[str, Any]) -> Optional[str]:
    """
    Rend un petit graphique à partir d'un chart_spec minimal
    si le code du LLM n'a produit aucune figure. Retourne base64 ou None.
    """
    if not isinstance(spec, dict):
        return None

    t = (spec.get("type") or "").lower()
    try:
        if t == "histogram":
            # colonne x explicite sinon première numérique
            x = spec.get("x")
            if not x:
                num_cols = df.select_dtypes(include=[np.number]).columns
                if len(num_cols) == 0:
                    return None
                x = num_cols[0]
            bins = int(spec.get("bins", 30))
            plt.figure()
            ax = sns.histplot(df[x].dropna(), bins=bins)
            ax.set_title(f"Histogramme de {x}")
            ax.set_xlabel(x)
            ax.set_ylabel("Fréquence")
            img = _render_chart_to_base64()
            plt.close("all")
            return img

        # (tu peux ajouter d'autres types ici: bar, line, pie, scatter…)
        return None
    except Exception:
        plt.close("all")
        return None


def run_pandas_analysis(dataset_path: Optional[str], code: str):
    """
    Exécute du code Pandas/Numpy/Sklearn généré par le LLM.
    - dataset_path peut être None (chargement fait dans `code`, ex: DuckDB -> df)
    - Retourne rows/chart/summary/chart_spec/stdout/result
    """
    # 1) éventuel chargement initial local
    df = None
    if dataset_path:
        low = dataset_path.lower()
        if low.endswith(".csv"):
            df = pd.read_csv(dataset_path)
        elif low.endswith(".xlsx") or low.endswith(".xls"):
            df = pd.read_excel(dataset_path)
        else:
            raise ValueError("Format non supporté (CSV/XLSX/XLS)")

    # 2) environnement restreint
    safe_builtins = {
        "abs": abs, "min": min, "max": max, "sum": sum, "len": len,
        "range": range, "enumerate": enumerate, "zip": zip, "round": round,
        "print": print, "list": list, "dict": dict, "set": set, "sorted": sorted,
        "float": float, "int": int, "str": str, "bool": bool,
    }

    env = {
        "pd": pd,
        "np": np,
        "sns": sns,
        "plt": plt,
        "LinearRegression": LinearRegression,
        "IsolationForest": IsolationForest,
    }
    if df is not None:
        env["df"] = df

    stdout = io.StringIO()
    try:
        with contextlib.redirect_stdout(stdout):
            exec(code, {"__builtins__": safe_builtins}, env)

        out = {}

        # rows si un DF/Series de sortie est dispo
        for key in ("result_df", "df_out", "output_df", "result", "df"):
            obj = env.get(key)
            if isinstance(obj, pd.Series):
                df_res = obj.to_frame(name=obj.name or "value").reset_index()
                out["rows"] = df_res.to_dict(orient="records")
                break
            if isinstance(obj, pd.DataFrame):
                out["rows"] = obj.reset_index(drop=True).to_dict(orient="records")
                break

        # chart si une figure existe
        if plt.get_fignums():
            out["chart"] = _render_chart_to_base64()

        # summary / chart_spec éventuels fournis par le code
        if isinstance(env.get("summary"), str):
            out["summary"] = env["summary"]
        if env.get("chart_spec") is not None:
            out["chart_spec"] = env["chart_spec"]

        # stdout et fallback texte
        out["stdout"] = stdout.getvalue()
        if not out.get("rows") and not out.get("chart"):
            out["result"] = str(env.get("result", "ok"))

        # 🔁 Fallback : si pas d'image MAIS chart_spec fourni → on tente un rendu basique
        if not out.get("chart") and out.get("chart_spec") is not None:
            # tente de récupérer un df courant dans l'env
            df_for_plot = env.get("df")
            if isinstance(df_for_plot, pd.DataFrame):
                img = _fallback_plot_from_spec(df_for_plot, out["chart_spec"])
                if img:
                    out["chart"] = img

        return out

    except Exception as e:
        return {"error": str(e), "stdout": stdout.getvalue()}

    finally:
        plt.close("all")
