import os, re
from pathlib import Path
from django.conf import settings

def normalize_filename(name: str) -> str:
    # garde [a-z0-9], remplace le reste par "_"
    return re.sub(r'[^A-Za-z0-9]+', '_', name).strip('_').lower()

def dataset_path(dataset: str, ext: str = "csv") -> Path:
    """Retourne le chemin ABSOLU du fichier dataset normalisé."""
    fname = f"{normalize_filename(dataset)}.{ext.lower()}"
    return settings.DATASETS_DIR / fname
