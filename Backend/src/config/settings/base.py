import os
from pathlib import Path

# ----- Paths -----
# Base du projet (2 niveaux au-dessus de config/settings.py)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Optionnel: dossier dedie aux datasets
DATASETS_DIR = DATA_DIR / "datasets"
DATASETS_DIR.mkdir(parents=True, exist_ok=True)

# ----- Core -----
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev_only_change_me")
DEBUG = os.getenv("DJANGO_DEBUG", "0") == "1"

# ALLOWED_HOSTS par defaut + env
_default_hosts = {"localhost", "127.0.0.1", "[::1]"}
ALLOWED_HOSTS = [h for h in os.getenv("DJANGO_ALLOWED_HOSTS", "").split(",") if h] or list(_default_hosts)

# ----- Applications -----
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # 3rd party
    "rest_framework",
    "corsheaders",

    # project apps
    "common",
    "users",
    "analytics",
    "integrations",
]

AUTH_USER_MODEL = "users.User"

# ----- Middleware -----
MIDDLEWARE = [
    # ordre recommande
    "django.middleware.security.SecurityMiddleware",

    # cors avant CommonMiddleware
    "corsheaders.middleware.CorsMiddleware",

    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",

    "common.middleware.RequestIDMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ----- Database (Django admin/auth only; analytics uses DuckDB) -----
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": str(DATA_DIR / "django.sqlite3"),
    }
}

# ----- Password validation -----
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ----- Internationalization -----
LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "America/Toronto"
USE_I18N = True
USE_TZ = True

# ----- Static files -----
STATIC_URL = "/static/"
STATIC_ROOT = str(BASE_DIR / "static")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ----- DRF -----
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DATETIME_FORMAT": "%Y-%m-%dT%H:%M:%S%z",
}

# ----- CORS / CSRF -----
CORS_ALLOW_CREDENTIALS = True



CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


# si tu as un front public (ex vercel) ajoute-le ici:
_CSFR_ENV = os.getenv("CSRF_TRUSTED_ORIGINS", "")
if _CSFR_ENV:
    CSRF_TRUSTED_ORIGINS = [u for u in _CSFR_ENV.split(",") if u]

# ----- DuckDB -----
DUCKDB_PATH = os.getenv("DUCKDB_PATH", str(DATA_DIR / "insight.duckdb"))

# ----- Logs simples -----
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"simple": {"format": "[%(levelname)s] %(name)s: %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "simple"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
