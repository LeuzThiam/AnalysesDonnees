"""
Client n8n (Webhook1) : transforme une question en SQL ou plan d'analyse.
"""

from __future__ import annotations
import json, os, requests, logging
from typing import Any, Dict, Optional
from requests.auth import HTTPBasicAuth
from requests.exceptions import RequestException
from django.conf import settings

__all__ = ["is_configured", "nl_to_sql", "N8nError"]

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 🔧 Configuration
# ---------------------------------------------------------------------------
_URL = (
    getattr(settings, "N8N_NL2SQL_URL", None)
    or os.getenv("N8N_NL2SQL_URL")
    or ""
).strip()

_USER = os.getenv("N8N_BASIC_AUTH_USER") or ""
_PASS = os.getenv("N8N_BASIC_AUTH_PASSWORD") or ""
_TIMEOUT = int(os.getenv("N8N_TIMEOUT_SECONDS") or 30)
_VERIFY = str(os.getenv("N8N_VERIFY_SSL") or "1").lower() not in {"0", "false", "no"}
_AUTH = HTTPBasicAuth(_USER, _PASS) if _USER and _PASS else None


# ---------------------------------------------------------------------------
# ⚠️ Exception personnalisée
# ---------------------------------------------------------------------------
class N8nError(RuntimeError):
    """Erreur d'appel ou de réponse n8n."""


# ---------------------------------------------------------------------------
# ✅ Vérification configuration
# ---------------------------------------------------------------------------
def is_configured() -> bool:
    """True si le webhook n8n NL→SQL est configuré."""
    return bool(_URL)


def _require_url() -> str:
    if not _URL:
        raise N8nError("N8N_NL2SQL_URL non configuré (vérifie ton .env).")
    return _URL


# ---------------------------------------------------------------------------
# 🚀 Appel principal au webhook NL→SQL
# ---------------------------------------------------------------------------
def nl_to_sql(
    question: str,
    dataset: str,
    *,
    extra: Optional[Dict[str, Any]] = None,
    timeout: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Appelle le webhook n8n pour convertir une question en SQL.
    Retour attendu :
        {"sql": "...", "chart_spec": {...}, "summary": "..."}
    """
    url = _require_url()
    payload = {"question": question, "dataset": dataset}
    if extra:
        payload.update(extra)

    logger.info(f"[n8n] POST {url} payload_keys={list(payload.keys())}")

    try:
        resp = requests.post(
            url,
            json=payload,
            auth=_AUTH,
            timeout=timeout or _TIMEOUT,
            verify=_VERIFY,
            headers={"Content-Type": "application/json"},
        )
    except RequestException as e:
        raise N8nError(f"Appel n8n échoué ({url}) : {e}") from e

    if resp.status_code >= 400:
        raise N8nError(f"n8n HTTP {resp.status_code}: {resp.text[:400]}")

    try:
        data = resp.json()
    except Exception:
        raise N8nError(f"Réponse n8n non JSON: {resp.text[:400]}")

    if not isinstance(data, dict) or not (data.get("sql") or data.get("plan")):
        raise N8nError("Réponse n8n invalide : champ 'sql' ou 'plan' requis.")
    return data
