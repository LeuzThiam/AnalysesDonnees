import pytest
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_query_sql_basic_select():
    client = APIClient()
    url = reverse("analytics_query_sql")
    r = client.post(url, {"sql": "SELECT 1 AS x"}, format="json")
    assert r.status_code == 200, r.content
    assert "rows" in r.data
    assert isinstance(r.data["rows"], list)
    assert r.data["rows"][0]["x"] in (1, 1.0)  # selon backend


@pytest.mark.django_db
def test_query_sql_guard_blocks_dangerous():
    client = APIClient()
    url = reverse("analytics_query_sql")
    r = client.post(url, {"sql": "DROP TABLE foo"}, format="json")
    assert r.status_code == 400
    assert "error" in r.data
