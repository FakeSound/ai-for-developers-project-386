"""Создание брони: сетка, окно записи и правило глобальной занятости."""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from conftest import (
    API,
    all_slot_starts,
    booking_payload,
    first_free_slot,
    shifted,
    slots_page,
    weekend_wall_time,
    workday_wall_time,
)


def create(client, event_type_id, starts_at, **kwargs):
    return client.post(
        f"{API}/bookings", json=booking_payload(event_type_id, starts_at, **kwargs)
    )


def test_creates_booking_from_free_slot(client):
    slot = first_free_slot(client, "znakomstvo")

    response = create(client, "znakomstvo", slot["startsAt"], notes="Первый раз.")

    assert response.status_code == 201
    booking = response.json()
    assert booking["id"]
    assert booking["createdAt"]
    assert booking["startsAt"] == slot["startsAt"]
    # Конец встречи считает сервер: начало плюс длительность типа события.
    assert booking["endsAt"] == slot["endsAt"]
    assert (
        datetime.fromisoformat(booking["endsAt"])
        - datetime.fromisoformat(booking["startsAt"])
    ) == timedelta(minutes=30)
    assert booking["eventType"] == {
        "id": "znakomstvo",
        "title": "Знакомство",
        "durationMinutes": 30,
    }
    assert booking["guest"] == {"name": "Иван Гость", "email": "ivan@example.com"}
    assert booking["notes"] == "Первый раз."


def test_booking_without_notes_omits_the_field(client):
    slot = first_free_slot(client, "znakomstvo")

    booking = create(client, "znakomstvo", slot["startsAt"]).json()

    assert "notes" not in booking


def test_booked_slot_disappears_from_calendar(client):
    slot = first_free_slot(client, "znakomstvo")

    create(client, "znakomstvo", slot["startsAt"])

    assert slot["startsAt"] not in all_slot_starts(slots_page(client, "znakomstvo"))


def test_same_time_is_taken_for_another_event_type(client):
    """Ключевое правило: календарь один на все типы событий."""
    slot = first_free_slot(client, "znakomstvo")
    assert create(client, "znakomstvo", slot["startsAt"]).status_code == 201

    response = create(client, "konsultaciya", slot["startsAt"])

    assert response.status_code == 409
    assert response.json()["code"] == "slot_taken"


def test_partial_overlap_is_taken(client):
    """Часовая встреча занимает и следующий получасовой слот."""
    slot = first_free_slot(client, "konsultaciya")
    assert create(client, "konsultaciya", slot["startsAt"]).status_code == 201

    response = create(client, "znakomstvo", shifted(slot["startsAt"], minutes=30))

    assert response.status_code == 409
    assert response.json()["code"] == "slot_taken"


def test_repeated_booking_of_the_same_slot_is_taken(client):
    slot = first_free_slot(client, "bystryj-zvonok")
    assert create(client, "bystryj-zvonok", slot["startsAt"]).status_code == 201

    response = create(client, "bystryj-zvonok", slot["startsAt"])

    assert response.status_code == 409
    assert response.json()["code"] == "slot_taken"


def test_time_off_the_grid_is_rejected(client):
    slot = first_free_slot(client, "znakomstvo")

    response = create(client, "znakomstvo", shifted(slot["startsAt"], minutes=7))

    assert response.status_code == 409
    assert response.json()["code"] == "slot_not_in_grid"


def test_non_working_day_is_off_the_grid(client):
    response = create(client, "znakomstvo", weekend_wall_time())

    assert response.status_code == 409
    assert response.json()["code"] == "slot_not_in_grid"


def test_time_after_work_day_end_is_off_the_grid(client):
    """Часовая встреча в 17:30 не помещается до 18:00, значит слота нет."""
    response = create(client, "konsultaciya", workday_wall_time(3, "17:30"))

    assert response.status_code == 409
    assert response.json()["code"] == "slot_not_in_grid"


def test_time_beyond_window_is_rejected(client):
    response = create(client, "znakomstvo", workday_wall_time(30))

    assert response.status_code == 409
    assert response.json()["code"] == "slot_out_of_window"


def test_time_in_the_past_is_rejected(client):
    response = create(client, "znakomstvo", workday_wall_time(-1))

    assert response.status_code == 409
    assert response.json()["code"] == "slot_out_of_window"


def test_unknown_event_type_returns_404(client):
    slot = first_free_slot(client, "znakomstvo")

    response = create(client, "net-takogo", slot["startsAt"])

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


@pytest.mark.parametrize(
    "patch",
    [
        {"guest": {"name": "Иван", "email": "не-почта"}},
        {"guest": {"name": "", "email": "ivan@example.com"}},
        {"guest": {"name": "x" * 101, "email": "ivan@example.com"}},
        {"guest": {"email": "ivan@example.com"}},
        {"notes": "x" * 501},
        {"startsAt": "не дата"},
        {"startsAt": "2026-08-17T11:00:00"},
    ],
    ids=[
        "bad-email",
        "empty-name",
        "long-name",
        "no-name",
        "long-notes",
        "bad-datetime",
        "naive-datetime",
    ],
)
def test_invalid_payload_is_rejected(client, patch):
    slot = first_free_slot(client, "znakomstvo")

    response = create(client, "znakomstvo", slot["startsAt"], **patch)

    assert response.status_code == 400
    assert response.json()["code"] == "validation_failed"


def test_created_booking_appears_in_admin_list(client):
    slot = first_free_slot(client, "znakomstvo")

    created = create(client, "znakomstvo", slot["startsAt"], notes="Увидимся.").json()

    bookings = client.get(f"{API}/admin/bookings").json()
    assert created["id"] in [booking["id"] for booking in bookings]
    assert created in bookings
