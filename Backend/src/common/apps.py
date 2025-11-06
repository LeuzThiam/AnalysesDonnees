from django.apps import AppConfig


class CommonConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "common"
    verbose_name = "Common / Utilitaires"

    def ready(self) -> None:
        # Point d'accroche pour signaux si besoin
        return None
