from __future__ import annotations
from typing import Any, Dict

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status

from .n8n import nl_to_sql, N8nError, is_configured


class N8nHealthView(APIView):
    """Indique si l'URL n8n est configuree (ping local)."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({"configured": bool(is_configured())})

class NL2SQLView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data: Dict[str, Any] = request.data or {}
        q = (data.get("question") or "").strip()
        ds = (data.get("dataset") or "").strip()
        if not q or not ds:
            return Response({"error": "question + dataset requis"}, status=status.HTTP_400_BAD_REQUEST)

        extra = {k: v for k, v in data.items() if k not in {"question", "dataset"}}
        try:
            payload = nl_to_sql(q, ds, extra=extra)
        except N8nError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(payload)
