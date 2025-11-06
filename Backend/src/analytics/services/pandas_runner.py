import io
import base64
import contextlib
from typing import Optional, Any, Dict

# --- BACKEND HEADLESS ---
import matplotlib
matplotlib.use("Agg")  # empêche tout affichage GUI
import matplotlib.pyplot as plt

import pandas as pd
import numpy as np
import seaborn as sns
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import IsolationForest


# ============================
# 🔹 UTILITAIRES GRAPHIQUES
# ============================

def _render_chart_to_base64() -> str:
    """Convertit la figure Matplotlib actuelle en PNG base64 pour le frontend."""
    buf = io.BytesIO()
    plt.savefig(buf, format="png", bbox_inches="tight")
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def _fallback_plot_from_spec(df: pd.DataFrame, spec: Dict[str, Any]) -> Optional[str]:
    """
    Rendu automatique d’un graphique minimal à partir d’un chart_spec
    si le code du LLM n’a pas généré de figure.
    """
    if not isinstance(spec, dict):
        return None

    t = (spec.get("type") or "").lower()
    try:
        plt.figure()

        # Histogramme
        if t == "histogram":
            x = spec.get("x")
            if not x:
                num_cols = df.select_dtypes(include=[np.number]).columns
                if len(num_cols) == 0:
                    return None
                x = num_cols[0]
            bins = int(spec.get("bins", 30))
            ax = sns.histplot(df[x].dropna(), bins=bins)
            ax.set_title(f"Histogramme de {x}")
            ax.set_xlabel(x)
            ax.set_ylabel("Fréquence")

        # Bar chart
        elif t == "bar":
            x = spec.get("x")
            y = spec.get("y")
            if x and y and x in df.columns and y in df.columns:
                sns.barplot(data=df, x=x, y=y)
                plt.xticks(rotation=45)
                plt.title(f"{y} par {x}")

        # Scatter plot
        elif t == "scatter":
            x = spec.get("x")
            y = spec.get("y")
            if x and y and x in df.columns and y in df.columns:
                sns.scatterplot(data=df, x=x, y=y)
                plt.title(f"{y} vs {x}")

        # Line chart
        elif t == "line":
            x = spec.get("x")
            y = spec.get("y")
            if x and y and x in df.columns and y in df.columns:
                sns.lineplot(data=df, x=x, y=y)
                plt.title(f"Évolution de {y} selon {x}")

        else:
            plt.close("all")
            return None

        img = _render_chart_to_base64()
        plt.close("all")
        return img

    except Exception:
        plt.close("all")
        return None


# ==================================
# 🔹 EXÉCUTION SÉCURISÉE DU CODE PYTHON
# ==================================

def run_pandas_analysis(code: str, dataset_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Exécute du code Python généré par le LLM (analyses Pandas/Numpy/Sklearn).
    🔸 Gère les DataFrames, stdout, summary, chart_spec et figures Matplotlib.
    🔸 Retourne un dict JSON-ready pour le frontend.

    Arguments :
        - code : code Python à exécuter (texte brut)
        - dataset_path : chemin du dataset CSV/XLSX si applicable
    """
    # 1️⃣ Chargement optionnel d’un dataset
    df = None
    if dataset_path:
        low = dataset_path.lower()
        if low.endswith(".csv"):
            df = pd.read_csv(dataset_path)
        elif low.endswith((".xlsx", ".xls")):
            df = pd.read_excel(dataset_path)
        else:
            raise ValueError("Format non supporté (CSV ou XLSX requis).")

    # 2️⃣ Espace d’exécution restreint
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
        # 3️⃣ Exécution du code utilisateur (capturée)
        with contextlib.redirect_stdout(stdout):
            exec(code, {"__builtins__": safe_builtins}, env)

        out: Dict[str, Any] = {}

        # 4️⃣ Recherche d’un DataFrame de sortie
        for key in ("result_df", "df_out", "output_df", "result", "df"):
            obj = env.get(key)
            if isinstance(obj, pd.Series):
                df_res = obj.to_frame(name=obj.name or "value").reset_index()
                out["rows"] = df_res.to_dict(orient="records")
                break
            elif isinstance(obj, pd.DataFrame):
                out["rows"] = obj.reset_index(drop=True).to_dict(orient="records")
                break

        # 5️⃣ Si un graphique existe → encodage base64
        if plt.get_fignums():
            out["chart"] = _render_chart_to_base64()

        # 6️⃣ Ajout des champs optionnels
        if isinstance(env.get("summary"), str):
            out["summary"] = env["summary"]
        if env.get("chart_spec") is not None:
            out["chart_spec"] = env["chart_spec"]

        # 7️⃣ Capture du stdout
        out["stdout"] = stdout.getvalue().strip()

        # 8️⃣ Fallback texte si aucun DataFrame ou chart
        if not out.get("rows") and not out.get("chart"):
            val = env.get("result")
            out["result"] = str(val if val is not None else "ok")

        # 9️⃣ Fallback graphique selon chart_spec (si fourni sans plt)
        if not out.get("chart") and out.get("chart_spec") is not None:
            df_for_plot = env.get("df")
            if isinstance(df_for_plot, pd.DataFrame):
                img = _fallback_plot_from_spec(df_for_plot, out["chart_spec"])
                if img:
                    out["chart"] = img

        return out

    except Exception as e:
        return {"error": str(e), "stdout": stdout.getvalue().strip()}

    finally:
        plt.close("all")
