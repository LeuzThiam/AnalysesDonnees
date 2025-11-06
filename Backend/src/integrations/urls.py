from django.urls import path
from .views import N8nHealthView, NL2SQLView

urlpatterns = [
    path("n8n/health", N8nHealthView.as_view(), name="n8n_health"),
    path("n8n/nl2sql", NL2SQLView.as_view(), name="n8n_nl2sql"),
]
