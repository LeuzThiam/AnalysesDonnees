from django.apps import AppConfig


class IntegrationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "integrations"
    verbose_name = "Integrations"

    def ready(self) -> None:
        # Brancher des signaux ici si besoin (imports tardifs)
        return None
