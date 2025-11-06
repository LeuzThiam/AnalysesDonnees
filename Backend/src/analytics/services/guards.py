# Backend/src/analytics/services/guards.py
from __future__ import annotations
import re
from typing import Optional

# Regex pré-compilée, sûre
_LIMIT_RE = re.compile(r"(?is)\blimit\s+\d+\b")

# Liste simple (pas de regex dynamiques hasardeuses)
_BANNED_TOKENS = {
    " drop ", " delete ", " update ", " insert ", " alter ", " create ",
    " attach ", " pragma ", " call ", " replace ", " vacuum ",
    " copy ", " load ", " import ",
}

def is_safe(sql: str) -> bool:
    """
    Retourne True si la requête est un SELECT "inoffensif".
    Ne lève JAMAIS d'exception.
    """
    if not sql:
        return False

    s = sql.strip().lower()
    if not s.startswith("select"):
        return False

    # Pas de commentaires
    if "--" in s or "/*" in s:
        return False

    # Tokens DDL/DML/DCL interdits
    padded = f" {s} "
    for tok in _BANNED_TOKENS:
        if tok in padded:
            return False

    return True


def add_limit_if_missing(sql: str, n: Optional[int]) -> str:
    """
    Ajoute LIMIT n si absent. Ne lève pas d'exception.
    """
    if not sql:
        return sql
    if not n:
        return sql

    s = sql.strip().rstrip(";")
    if not _LIMIT_RE.search(s):
        s = f"{s} LIMIT {int(n)}"
    return s


def wrap_sample(sql: str, perc: Optional[float]) -> str:
    """
    Enveloppe la requête dans un FROM (subquery) ... USING SAMPLE.
    Evite toute regex fragile. Ne lève pas d'exception.
    """
    if not sql or not perc:
        return sql
    perc = max(0.01, min(float(perc), 100.0))
    inner = sql.strip().rstrip(";")
    # Syntaxe DuckDB : FROM ( ... ) t USING SAMPLE <p> PERCENT
    return f"SELECT * FROM ({inner}) t USING SAMPLE {perc} PERCENT"
