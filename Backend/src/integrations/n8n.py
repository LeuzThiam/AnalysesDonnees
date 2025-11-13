"""
Client n8n : appelle un webhook qui transforme une question NL en SQL/plan.

Retour attendu côté n8n (au choix) :
- {"sql": "...", "chart_spec": {...}?, "summary": "..."}            # SQL direct
- {"plan": {...}, "chart_spec": {...}?, "summary": "..."}           # plan pour planner.py

Variables d'env :
- N8N_NL2SQL_URL                 (obligatoire)
- N8N_BASIC_AUTH_USER            (optionnel)
- N8N_BASIC_AUTH_PASSWORD        (optionnel)
- N8N_TIMEOUT_SECONDS            (optionnel, défaut 30)
- N8N_VERIFY_SSL                 (optionnel, "0"/"false" pour désactiver)
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional

import requests
from requests.auth import HTTPBasicAuth
from requests.exceptions import RequestException
from django.conf import settings
import logging

__all__ = ["is_configured", "nl_to_sql", "N8nError"]

logger = logging.getLogger(__name__)

# --- Configuration -----------------------------------------------------------
# Priorité à settings (donc à ton .env via local.py) puis fallback sur env direct.
_URL = (getattr(settings, "N8N_NL2SQL_URL", None)
        or os.getenv("N8N_NL2SQL_URL")
        or "").strip()

_USER = os.getenv("N8N_BASIC_AUTH_USER") or ""
_PASS = os.getenv("N8N_BASIC_AUTH_PASSWORD") or ""
_TIMEOUT = int(os.getenv("N8N_TIMEOUT_SECONDS") or 30)
_VERIFY = str(os.getenv("N8N_VERIFY_SSL") or "1").lower() not in {"0", "false", "no"}

_AUTH = HTTPBasicAuth(_USER, _PASS) if _USER and _PASS else None


# --- Exceptions --------------------------------------------------------------
class N8nError(RuntimeError):
    """Erreur d'appel ou de réponse n8n."""


# --- Helpers ----------------------------------------------------------------
def is_configured() -> bool:
    """True si l'URL n8n est configurée."""
    return bool(_URL)


def _require_url() -> str:
    if not _URL:
        raise N8nError("N8N_NL2SQL_URL non configuré.")
    return _URL


def _parse_json_safely(resp: requests.Response) -> Dict[str, Any]:
    """Essaye de parser la réponse en JSON, même si le header est incorrect."""
    if not resp.content:
        return {}
    try:
        return resp.json()
    except ValueError:
        pass
    try:
        return json.loads(resp.text)
    except Exception as e:  # pragma: no cover
        raise N8nError(f"Réponse n8n non JSON: {resp.text[:400]}") from e


def _validate_payload(d: Dict[str, Any]) -> Dict[str, Any]:
    """Valide qu'on a bien au moins 'sql' ou 'plan'."""
    if not isinstance(d, dict):
        raise N8nError("Réponse n8n invalide (objet JSON attendu).")
    if not (d.get("sql") or d.get("plan")):
        raise N8nError("Réponse n8n incomplète : champ 'sql' ou 'plan' requis.")
    return d


# --- API --------------------------------------------------------------------
def nl_to_sql(
    question: str,
    dataset: str,
    *,
    extra: Optional[Dict[str, Any]] = None,
    timeout: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Appelle le webhook n8n.
    """
    url = _require_url()
    payload: Dict[str, Any] = {"question": question, "dataset": dataset}
    if extra:
        payload.update(extra)

    logger.info("[n8n] POST %s payload_keys=%s", url, list(payload.keys()))

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
        raise N8nError(f"Appel n8n échoué: {e}") from e

    if resp.status_code >= 400:
        body = resp.text[:800]
        raise N8nError(f"n8n HTTP {resp.status_code}: {body}")

    data = _parse_json_safely(resp)
    return _validate_payload(data)
