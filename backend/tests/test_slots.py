"""Календарь свободных слотов: сетка, окно записи, глобальная занятость."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from conftest import API, all_slot_starts, slots_page

MSK = ZoneInfo("Europe/Moscow")


def local(moment: str) -> datetime:
    return datetime.fromisoformat(moment).astimezone(MSK)


def test_default_range_covers_whole_booking_window(client):
    page = slots_page(client, "znakomstvo")

    assert page["eventTypeId"] == "znakomstvo"
    assert page["durationMinutes"] == 30
    assert page["timeZone"] == "Europe/Moscow"

    today = datetime.now(MSK).date()
    assert page["from"] == today.isoformat()
    assert page["to"] == (today + timedelta(days=14)).isoformat()
    # Дни без свободных слотов тоже присутствуют — с пустым массивом.
    assert len(page["days"]) == 15


def test_days_are_consecutive_and_weekends_are_empty(client):
    page = slots_page(client, "znakomstvo")
    days = [datetime.fromisoformat(day["date"]).date() for day in page["days"]]

    assert days == sorted(days)
    assert all(b - a == timedelta(days=1) for a, b in zip(days, days[1:]))

    for day in page["days"]:
        weekday = datetime.fromisoformat(day["date"]).weekday()
        if weekday >= 5:
            assert day["slots"] == [], day["date"]


def test_slots_follow_owner_grid(client):
    page = slots_page(client, "konsultaciya")

    for day in page["days"]:
        for slot in day["slots"]:
            starts_at, ends_at = local(slot["startsAt"]), local(slot["endsAt"])

            assert starts_at.minute in (0, 30)
            assert starts_at.second == 0
            assert (starts_at.hour, starts_at.minute) >= (10, 0)
            # Последний слот заканчивается не позже конца рабочего дня.
            assert (ends_at.hour, ends_at.minute) <= (18, 0)
            assert ends_at - starts_at == timedelta(minutes=60)


def test_slots_are_in_the_future(client):
    now = datetime.now(timezone.utc)

    for starts_at in all_slot_starts(slots_page(client, "bystryj-zvonok")):
        assert datetime.fromisoformat(starts_at) > now


def test_seeded_bookings_are_excluded_from_every_event_type(client):
    """Занятость глобальная: чужая бронь убирает слот и у другого типа события."""
    bookings = client.get(f"{API}/admin/bookings").json()
    assert bookings, "сиды должны создать хотя бы одну бронь"

    busy = [
        (
            datetime.fromisoformat(booking["startsAt"]),
            datetime.fromisoformat(booking["endsAt"]),
        )
        for booking in bookings
    ]

    for event_type_id, duration in [
        ("znakomstvo", 30),
        ("konsultaciya", 60),
        ("bystryj-zvonok", 15),
    ]:
        for starts_at in all_slot_starts(slots_page(client, event_type_id)):
            start = datetime.fromisoformat(starts_at)
            end = start + timedelta(minutes=duration)
            assert not any(
                start < busy_end and end > busy_start for busy_start, busy_end in busy
            ), f"{event_type_id} отдал занятый слот {starts_at}"


def test_explicit_range_narrows_output(client):
    today = datetime.now(MSK).date()
    date_from = (today + timedelta(days=2)).isoformat()
    date_to = (today + timedelta(days=4)).isoformat()

    page = slots_page(client, "znakomstvo", **{"from": date_from, "to": date_to})

    assert page["from"] == date_from
    assert page["to"] == date_to
    assert [day["date"] for day in page["days"]] == [
        date_from,
        (today + timedelta(days=3)).isoformat(),
        date_to,
    ]


def test_range_beyond_window_is_rejected(client):
    today = datetime.now(MSK).date()

    response = client.get(
        f"{API}/event-types/znakomstvo/slots",
        params={"to": (today + timedelta(days=15)).isoformat()},
    )

    assert response.status_code == 400
    assert response.json()["code"] == "validation_failed"


def test_range_before_today_is_rejected(client):
    today = datetime.now(MSK).date()

    response = client.get(
        f"{API}/event-types/znakomstvo/slots",
        params={"from": (today - timedelta(days=1)).isoformat()},
    )

    assert response.status_code == 400
    assert response.json()["code"] == "validation_failed"


def test_reversed_range_is_rejected(client):
    today = datetime.now(MSK).date()

    response = client.get(
        f"{API}/event-types/znakomstvo/slots",
        params={
            "from": (today + timedelta(days=5)).isoformat(),
            "to": (today + timedelta(days=2)).isoformat(),
        },
    )

    assert response.status_code == 400
    assert response.json()["code"] == "validation_failed"


def test_malformed_date_is_rejected(client):
    response = client.get(
        f"{API}/event-types/znakomstvo/slots", params={"from": "вчера"}
    )

    assert response.status_code == 400
    assert response.json()["code"] == "validation_failed"


def test_slots_of_unknown_event_type_return_404(client):
    response = client.get(f"{API}/event-types/net-takogo/slots")

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
