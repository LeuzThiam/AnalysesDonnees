from .base import *

# Tests
DEBUG = True

# DB sqlite en mémoire par défaut pour rapidité
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# Auth plus légère en test
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Email capturé en mémoire
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# DRF: permissions ouvertes pour les tests d’intégration
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
}
