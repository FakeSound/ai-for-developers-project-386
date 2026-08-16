"""Профиль владельца."""

from __future__ import annotations

from conftest import API

REQUIRED = {
    "id",
    "name",
    "email",
    "timeZone",
    "workdays",
    "workDayStart",
    "workDayEnd",
    "slotStepMinutes",
    "bookingWindowDays",
}


def test_owner_has_all_contract_fields(client):
    response = client.get(f"{API}/owner")

    assert response.status_code == 200
    assert REQUIRED <= set(response.json())


def test_owner_describes_slot_grid(client):
    owner = client.get(f"{API}/owner").json()

    assert owner["timeZone"] == "Europe/Moscow"
    assert owner["workdays"] == [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
    ]
    assert owner["workDayStart"] == "10:00"
    assert owner["workDayEnd"] == "18:00"
    assert owner["slotStepMinutes"] == 30
    assert owner["bookingWindowDays"] == 14
