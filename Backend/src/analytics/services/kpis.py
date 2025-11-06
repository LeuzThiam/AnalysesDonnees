"""
KPIs et petites fonctions statistiques reutilisables
(utilisables dans des post-traitements Django si besoin).
"""
from __future__ import annotations
from typing import Iterable, Optional
import math


def safe_div(a: float, b: float, default: float = 0.0) -> float:
    try:
        return a / b if b not in (0, 0.0, None) else default
    except Exception:
        return default


def growth_rate(curr: float, prev: float) -> float:
    """Taux de croissance ( (curr - prev) / abs(prev) )."""
    if prev in (0, 0.0, None):
        return 0.0
    return (curr - prev) / abs(prev)


def mean(xs: Iterable[float]) -> Optional[float]:
    xs = list(x for x in xs if x is not None)
    if not xs:
        return None
    return sum(xs) / len(xs)


def stddev_pop(xs: Iterable[float]) -> Optional[float]:
    xs = list(x for x in xs if x is not None)
    if not xs:
        return None
    m = mean(xs)
    if m is None:
        return None
    var = sum((x - m) ** 2 for x in xs) / len(xs)
    return math.sqrt(var)


def zscore(x: float, mu: float, sigma: float) -> float:
    if sigma in (0, 0.0, None):
        return 0.0
    return (x - mu) / sigma
