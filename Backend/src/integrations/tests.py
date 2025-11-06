import pytest
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_n8n_health():
    client = APIClient()
    url = reverse("integrations_n8n_health")
    r = client.get(url)
    assert r.status_code == 200
    assert "configured" in r.data
    assert isinstance(r.data["configured"], bool)
