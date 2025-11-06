from typing import Optional
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import APIException


class UserFacingAPIException(APIException):
    """
    Exception controllable et propre pour retourner un message a l'utilisateur.
    """
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Une erreur est survenue."
    default_code = "error"


def custom_exception_handler(exc, context) -> Optional[Response]:
    """
    Enveloppe les erreurs DRF dans un format stable.
    Pour l'activer: dans settings, mettre
    REST_FRAMEWORK['EXCEPTION_HANDLER'] = 'common.exceptions.custom_exception_handler'
    """
    response = exception_handler(exc, context)

    if response is not None:
        data = {
            "error": {
                "code": getattr(exc, "default_code", "error"),
                "detail": response.data,
                "status": response.status_code,
            }
        }
        response.data = data
        return response

    # Erreur non geree -> 500
    return Response(
        {"error": {"code": "server_error", "detail": "Erreur interne", "status": 500}},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
