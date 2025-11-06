from .base import *

# Production
DEBUG = False

# IMPORTANT: définir DJANGO_ALLOWED_HOSTS via variables d'env
# Exemple: export DJANGO_ALLOWED_HOSTS="app.example.com"
ALLOWED_HOSTS = [h for h in os.getenv("DJANGO_ALLOWED_HOSTS", "").split(",") if h] or ["*"]

# CORS: restreindre aux domaines du frontend en prod
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [u for u in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if u]

# Sécurité HTTP
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# DRF: par défaut authentifié en prod
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
}

# Logs simples vers stdout
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"simple": {"format": "[%(levelname)s] %(name)s: %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "simple"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
