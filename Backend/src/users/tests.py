import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.mark.django_db
def test_register_and_login_and_me():
    client = APIClient()

    # 1) Register
    r = client.post(
        reverse("register"),
        {
            "username": "alice",
            "email": "alice@example.com",
            "password": "StrongPassw0rd!",
            "first_name": "Alice",
            "last_name": "Doe",
        },
        format="json",
    )
    assert r.status_code == 201, r.content

    # 2) Login (JWT)
    r = client.post(
        reverse("token_obtain_pair"),
        {"username": "alice", "password": "StrongPassw0rd!"},
        format="json",
    )
    assert r.status_code == 200, r.content
    assert "access" in r.data
    token = r.data["access"]

    # 3) /me
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    r = client.get(reverse("me"))
    assert r.status_code == 200
    assert r.data["username"] == "alice"

    # 4) Change password
    r = client.post(
        reverse("change_password"),
        {"old_password": "StrongPassw0rd!", "new_password": "An0therStrongPass!"},
        format="json",
    )
    assert r.status_code == 200
