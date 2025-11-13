"""
Client n8n pour l'analyse automatique des résultats (Webhook2).
Gère la communication entre Django et le workflow n8n /analyse-resultats.
"""

from __future__ import annotations
import json
import os
import decimal
import logging
import requests
from typing import Any, Dict, List, Optional
from requests.auth import HTTPBasicAuth
from requests.exceptions import RequestException
from django.conf import settings

__all__ = ["is_configured", "analyze_result", "N8nError"]

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 🔧 Configuration
# ---------------------------------------------------------------------------
_URL = (
    getattr(settings, "N8N_ANALYSE_URL", None)
    or os.getenv("N8N_ANALYSE_URL")
    or ""
).strip()

_USER = os.getenv("N8N_BASIC_AUTH_USER") or ""
_PASS = os.getenv("N8N_BASIC_AUTH_PASSWORD") or ""
_TIMEOUT = int(os.getenv("N8N_ANALYSE_TIMEOUT") or os.getenv("N8N_TIMEOUT_SECONDS") or 30)
_VERIFY = str(os.getenv("N8N_VERIFY_SSL") or "1").lower() not in {"0", "false", "no"}

_AUTH = HTTPBasicAuth(_USER, _PASS) if _USER and _PASS else None


# ---------------------------------------------------------------------------
# ⚠️ Exceptions
# ---------------------------------------------------------------------------
class N8nError(RuntimeError):
    """Erreur d'appel ou de réponse n8n."""


# ---------------------------------------------------------------------------
# ✅ Vérification configuration
# ---------------------------------------------------------------------------
def is_configured() -> bool:
    """True si le webhook n8n /analyse-resultats est configuré."""
    return bool(_URL)


def _require_url() -> str:
    if not _URL:
        raise N8nError("N8N_ANALYSE_URL non configuré (vérifie ton .env ou settings.local.py).")
    return _URL


# ---------------------------------------------------------------------------
# 🔄 Helpers JSON (sécurise numpy, Decimal, etc.)
# ---------------------------------------------------------------------------
def _safe_json(obj: Any) -> Any:
    """Convertit proprement les objets non sérialisables JSON (Decimal, numpy...)."""
    try:
        import numpy as np
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, (np.bool_)):
            return bool(obj)
    except Exception:
        pass

    if isinstance(obj, decimal.Decimal):
        return float(obj)
    raise TypeError(f"Type non sérialisable pour JSON : {type(obj)}")


# ---------------------------------------------------------------------------
# 🚀 Appel principal au webhook n8n
# ---------------------------------------------------------------------------
def analyze_result(
    question: str,
    rows: List[Dict[str, Any]],
    chart_spec: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Appelle le webhook n8n d'analyse des résultats.
    En cas d'erreur réseau, renvoie une exception explicite.
    """

    url = _require_url()
    chart_spec = chart_spec or {}

    # Limite le nombre de lignes envoyées à n8n (évite les payloads trop lourds)
    limited_rows = rows[:200] if isinstance(rows, list) else []

    payload = {
        "question": question,
        "rows": limited_rows,
        "chart_spec": chart_spec,
    }

    # Sérialisation propre (convertit numpy/Decimal → JSON)
    try:
        payload_json = json.loads(json.dumps(payload, default=_safe_json))
    except Exception as e:
        logger.warning(f"Impossible de sérialiser le payload pour n8n : {e}")
        payload_json = payload

    logger.info(f"[n8n] → Analyse POST {url} (rows={len(limited_rows)}, timeout={_TIMEOUT}s)")

    try:
        resp = requests.post(
            url,
            json=payload_json,
            auth=_AUTH,
            timeout=_TIMEOUT,
            verify=_VERIFY,
            headers={"Content-Type": "application/json"},
        )
    except RequestException as e:
        raise N8nError(f"Appel n8n échoué ({url}) : {e}") from e

    if resp.status_code >= 400:
        logger.error(f"[n8n] Analyse HTTP {resp.status_code} : {resp.text[:400]}")
        raise N8nError(f"n8n HTTP {resp.status_code}: {resp.text[:400]}")

    # Tentative de parsing JSON
    try:
        result = resp.json()
        if not isinstance(result, dict):
            raise ValueError("Réponse n8n non conforme (pas un objet JSON).")
        return result
    except Exception as e:
        text = resp.text[:400].strip().replace("\n", " ")
        raise N8nError(f"Réponse n8n non JSON : {text}") from e
