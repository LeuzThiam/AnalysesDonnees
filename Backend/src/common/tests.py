from django.test import TestCase

# Create your tests here.
import pytest
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_health_and_ping():
    client = APIClient()

    r = client.get(reverse("health"))
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

    r = client.get(reverse("ping"))
    assert r.status_code == 200
    assert r.json()["pong"] is True
