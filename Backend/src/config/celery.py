import os

# Charger .env si present
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

from celery import Celery

# Definir le settings module Django par defaut
os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    os.getenv("DJANGO_SETTINGS_MODULE", "config.settings.local"),
)

app = Celery("AnalyseDesDonnees")

# Charger la config depuis Django (prefixe CELERY_ dans settings)
app.config_from_object("django.conf:settings", namespace="CELERY")

# Autodiscovery des tasks.py dans les apps installees
app.autodiscover_tasks()
