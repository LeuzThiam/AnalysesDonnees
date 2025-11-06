import os
from datetime import datetime, timezone
from typing import Dict, Any


def env_bool(name: str, default: bool = False) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.lower() in {"1", "true", "yes", "on"}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def dict_without_none(d: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in d.items() if v is not None}
