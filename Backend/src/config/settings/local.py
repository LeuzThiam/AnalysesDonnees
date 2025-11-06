from .base import *  # noqa

# --- Charger .env (Backend/.env) et ÉCRASER les variables OS si besoin -----
import os
from pathlib import Path
try:
    from dotenv import load_dotenv
    BASE_DIR = Path(__file__).resolve().parents[2]  # -> dossier Backend/
    # ⚠️ override=True pour écraser une variable déjà définie dans la session
    load_dotenv(BASE_DIR / ".env", override=True)
except Exception:
    # pas bloquant si python-dotenv n'est pas installé
    pass

# --- Dev local ---
DEBUG = True
ALLOWED_HOSTS = ["127.0.0.1", "localhost"]

# Si tu utilises Vite en dev
CSRF_TRUSTED_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]

# ⚠️ Ne pas ré-ajouter corsheaders ici (il est déjà dans base.py)
# -> pas de INSTALLED_APPS ni de MIDDLEWARE supplémentaires dans local.py

# CORS en dev
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# DRF: permissions ouvertes en dev
REST_FRAMEWORK.update({
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework.authentication.BasicAuthentication",
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
})

# Expose les valeurs lues (utilisées par le code applicatif)
N8N_NL2SQL_URL = os.getenv("N8N_NL2SQL_URL", "")
DUCKDB_PATH = os.getenv("DUCKDB_PATH", "data/insight.duckdb")
