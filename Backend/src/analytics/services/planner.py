# Backend/src/analytics/services/planner.py
from __future__ import annotations
from typing import Dict, Any
import re

def _id(name: str) -> str:
    if not name:
        raise ValueError("Identifiant vide")
    if re.search(r"[^0-9a-zA-Z_]", name):
        safe = name.replace('"', '""')
        return f'"{safe}"'
    return name


def build_sql_from_plan(plan: Dict[str, Any]) -> str:
    """
    Compile un plan en SQL DuckDB.
    Champs plan attendus (min):
      - intent: "timeseries_total" | "top_total" | "top_growth" | "anomaly_zscore"
      - dataset
      - date_col (si timeseries/anomaly/top_growth)
      - amount_col (optionnel => SUM(amount), sinon COUNT(*))
      - category_col (si top_total / top_growth)
      - year (si top_growth)
      - limit (optionnel, défaut 100)
    """
    intent = (plan.get("intent") or "").strip().lower()
    dataset = plan.get("dataset") or ""
    date_col = plan.get("date_col") or "date"
    amount_col = (plan.get("amount_col") or "").strip() or None
    category_col = plan.get("category_col") or "category"
    year = plan.get("year")
    limit = int(plan.get("limit") or 100)

    if not dataset:
        raise ValueError("'dataset' requis")

    agg = f"SUM({_id(amount_col)})" if amount_col else "COUNT(*)"

    if intent == "timeseries_total":
        return f"""SELECT date_trunc('day', {_id(date_col)}) AS ts, {agg} AS total
FROM {_id(dataset)}
GROUP BY 1
ORDER BY 1
LIMIT {limit};""".strip()

    if intent == "top_total":
        return f"""SELECT {_id(category_col)} AS category, {agg} AS total
FROM {_id(dataset)}
GROUP BY 1
ORDER BY total DESC
LIMIT {limit};""".strip()

    if intent == "top_growth":
        if not year:
            raise ValueError("'year' requis pour top_growth")
        prev = int(year) - 1
        val_prev = _id(amount_col) if amount_col else "1"
        val_curr = _id(amount_col) if amount_col else "1"
        return f"""WITH agg AS (
  SELECT {_id(category_col)} AS category,
         SUM(CASE WHEN EXTRACT(YEAR FROM {_id(date_col)}) = {prev} THEN {val_prev} ELSE 0 END) AS total_prev,
         SUM(CASE WHEN EXTRACT(YEAR FROM {_id(date_col)}) = {int(year)} THEN {val_curr} ELSE 0 END) AS total_curr
  FROM {_id(dataset)}
  GROUP BY 1
)
SELECT category,
       total_prev,
       total_curr,
       CASE WHEN total_prev = 0 THEN NULL ELSE (total_curr - total_prev) * 1.0 / total_prev END AS growth_ratio
FROM agg
ORDER BY growth_ratio DESC NULLS LAST
LIMIT {limit};""".strip()

    if intent == "anomaly_zscore":
        # si pas d'amount -> zscore sur comptage journalier
        val_expr = _id(amount_col) if amount_col else "1"
        return f"""WITH s AS (
  SELECT CAST({_id(date_col)} AS TIMESTAMP) AS ts, CAST(SUM({val_expr}) AS DOUBLE) AS val
  FROM {_id(dataset)}
  GROUP BY 1
),
stats AS (
  SELECT AVG(val) AS mu, STDDEV(val) AS sigma FROM s
)
SELECT s.ts, s.val,
       CASE WHEN stats.sigma IS NULL OR stats.sigma = 0 THEN 0
            ELSE (s.val - stats.mu) / stats.sigma END AS zscore
FROM s, stats
ORDER BY s.ts
LIMIT {limit};""".strip()

    # Fallback: preview
    return f"SELECT * FROM {_id(dataset)} LIMIT {limit};"
