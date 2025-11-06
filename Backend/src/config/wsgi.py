import os

# Charger les variables d'environnement depuis .env (si present)
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

from django.core.wsgi import get_wsgi_application

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    os.getenv("DJANGO_SETTINGS_MODULE", "config.settings.local"),
)

application = get_wsgi_application()
