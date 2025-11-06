import uuid
from typing import Callable
from django.http import HttpRequest, HttpResponse


class RequestIDMiddleware:
    """
    Ajoute un identifiant de requete a chaque reponse.
    - Header de sortie: X-Request-ID
    - Accessible via request.request_id
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        setattr(request, "request_id", request_id)

        response = self.get_response(request)
        response.headers["X-Request-ID"] = request_id
        return response
