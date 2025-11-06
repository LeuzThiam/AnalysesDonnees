import os
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions


class PingView(APIView):
    """
    GET /api/common/ping -> {"pong": true}
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({"pong": True})


class InfoView(APIView):
    """
    GET /api/common/info -> infos minimales d'environnement (non sensibles)
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            "debug": bool(getattr(settings, "DEBUG", False)),
            "env": os.getenv("DJANGO_ENV", "local"),
            "apps": sorted(getattr(settings, "INSTALLED_APPS", [])),
        })
