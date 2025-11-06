from django.http import JsonResponse


def health(request):
    """
    Endpoint de sante tres simple.
    GET /api/common/health -> {"status":"ok","service":"django"}
    """
    return JsonResponse({"status": "ok", "service": "django"})
