from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import RegisterView, MeView, ChangePasswordView

urlpatterns = [
    # Auth JWT (login / refresh)
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # Inscription
    path("register/", RegisterView.as_view(), name="register"),

    # Profil courant
    path("me/", MeView.as_view(), name="me"),

    # Changer le mot de passe
    path("change-password/", ChangePasswordView.as_view(), name="change_password"),
]
