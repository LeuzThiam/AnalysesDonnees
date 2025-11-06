from django.db import models

# Pas de modèles communs pour l'instant.
# Ce fichier existe pour permettre d'ajouter facilement
# des modèles partagés (ex: AuditLog) plus tard.
#
# Exemple (commenté) :
# class AuditLog(models.Model):
#     created_at = models.DateTimeField(auto_now_add=True)
#     level = models.CharField(max_length=32)
#     message = models.TextField()
#     context = models.JSONField(default=dict, blank=True)
#
#     class Meta:
#         ordering = ["-created_at"]
