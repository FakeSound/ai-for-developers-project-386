"""Типы событий: список, карточка, создание владельцем."""

from __future__ import annotations

import pytest
from conftest import API

VALID = {
    "id": "demo-vstrecha",
    "title": "Демо",
    "description": "Показываю, что уже работает.",
    "durationMinutes": 45,
}


def test_list_returns_seeded_types_sorted_by_created_at(client):
    types = client.get(f"{API}/event-types").json()

    assert [t["id"] for t in types] == [
        "znakomstvo",
        "konsultaciya",
        "bystryj-zvonok",
    ]
    assert [t["createdAt"] for t in types] == sorted(t["createdAt"] for t in types)


def test_create_returns_201_and_appears_in_list(client):
    response = client.post(f"{API}/event-types", json=VALID)

    assert response.status_code == 201
    created = response.json()
    assert created["id"] == VALID["id"]
    assert created["durationMinutes"] == 45
    assert created["createdAt"]

    ids = [t["id"] for t in client.get(f"{API}/event-types").json()]
    assert VALID["id"] in ids


def test_duplicate_id_conflicts(client):
    client.post(f"{API}/event-types", json=VALID)

    response = client.post(f"{API}/event-types", json=VALID)

    assert response.status_code == 409
    assert response.json()["code"] == "event_type_exists"


def test_duplicate_of_seeded_id_conflicts(client):
    response = client.post(f"{API}/event-types", json={**VALID, "id": "znakomstvo"})

    assert response.status_code == 409
    assert response.json()["code"] == "event_type_exists"


@pytest.mark.parametrize(
    "patch",
    [
        {"id": "Знакомство"},
        {"id": "with_underscore"},
        {"id": "trailing-"},
        {"id": "a" * 65},
        {"title": ""},
        {"title": "x" * 101},
        {"description": "x" * 1001},
        {"durationMinutes": 4},
        {"durationMinutes": 481},
        {"durationMinutes": "тридцать"},
    ],
    ids=lambda patch: next(iter(patch)) + "=" + str(next(iter(patch.values())))[:12],
)
def test_contract_constraints_are_enforced(client, patch):
    response = client.post(f"{API}/event-types", json={**VALID, **patch})

    assert response.status_code == 400
    assert response.json()["code"] == "validation_failed"


def test_missing_required_field_is_rejected(client):
    response = client.post(f"{API}/event-types", json={"id": "only-id"})

    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "validation_failed"
    assert body["details"]["fields"]


def test_read_returns_card(client):
    response = client.get(f"{API}/event-types/konsultaciya")

    assert response.status_code == 200
    assert response.json()["durationMinutes"] == 60


def test_read_unknown_returns_404(client):
    response = client.get(f"{API}/event-types/net-takogo")

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
