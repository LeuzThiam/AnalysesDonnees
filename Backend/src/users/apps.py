from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "users"
    verbose_name = "Utilisateurs"

    def ready(self) -> None:
        # Point d'entrée pour brancher des signaux si besoin (import local pour éviter les import cycles)
        # from . import signals  # noqa: F401
        return None
