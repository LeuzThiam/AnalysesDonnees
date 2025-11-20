"""
Client n8n (Webhook1) : transforme une question en SQL ou plan d'analyse.
"""

from __future__ import annotations
import json, os, requests, logging
from typing import Any, Dict, Optional
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

_TIMEOUT = int(os.getenv("N8N_TIMEOUT_SECONDS") or 30)
_VERIFY = str(os.getenv("N8N_VERIFY_SSL") or "1").lower() not in {"0", "false", "no"}


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
            timeout=timeout or _TIMEOUT,
            verify=_VERIFY,
            headers={"Content-Type": "application/json"},
        )
    except RequestException as e:
        logger.error(f"[n8n] Erreur réseau vers {url}: {e}")
        raise N8nError(f"Appel n8n échoué ({url}) : {e}") from e

    if resp.status_code >= 400:
        error_msg = resp.text[:400] if resp.text else "(pas de message d'erreur)"
        logger.error(f"[n8n] HTTP {resp.status_code} depuis {url}: {error_msg}")
        raise N8nError(f"n8n HTTP {resp.status_code} depuis {url}: {error_msg}")

    # Vérifier que la réponse n'est pas vide
    if not resp.text or not resp.text.strip():
        logger.error(f"[n8n] Réponse vide depuis {url} (status {resp.status_code}, Content-Type: {resp.headers.get('Content-Type', 'N/A')})")
        logger.error(f"[n8n] Headers complets: {dict(resp.headers)}")
        raise N8nError(f"n8n a renvoyé une réponse vide (status {resp.status_code}). Vérifie dans n8n que ton workflow 'AnalyseDonnees' s'exécute correctement et que le nœud 'Respond to Webhook' renvoie bien du JSON.")

    try:
        data = resp.json()
    except Exception as e:
        logger.error(f"[n8n] Réponse non JSON depuis {url}: {resp.text[:400]}")
        raise N8nError(f"Réponse n8n non JSON (status {resp.status_code}): {resp.text[:400]}")

    if not isinstance(data, dict) or not (data.get("sql") or data.get("plan")):
        raise N8nError("Réponse n8n invalide : champ 'sql' ou 'plan' requis.")
    return data
