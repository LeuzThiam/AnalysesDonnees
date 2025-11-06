from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Utilisateur custom de l'application.

    - Hérite d'AbstractUser (username, email, first_name, last_name, is_staff, etc.)
    - Tu peux ajouter ici des champs métier (organisation, role, etc.)
    """

    # Exemple de champs facultatifs (décommente si tu en as besoin)
    # organization = models.CharField(max_length=255, blank=True, default="")
    # job_title = models.CharField(max_length=255, blank=True, default="")
    # phone = models.CharField(max_length=50, blank=True, default="")

    def __str__(self) -> str:
        # Affiche le username si présent, sinon l'email
        return self.username or self.email

    class Meta:
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"
        ordering = ["id"]
