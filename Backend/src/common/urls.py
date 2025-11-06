from django.urls import path
from .health import health
from .views import PingView, InfoView

urlpatterns = [
    path("health", health, name="health"),
    path("ping", PingView.as_view(), name="ping"),
    path("info", InfoView.as_view(), name="info"),
]
