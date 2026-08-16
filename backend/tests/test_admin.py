"""Админская часть: список предстоящих встреч."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from conftest import API, booking_payload, first_free_slot


def test_upcoming_bookings_are_sorted_by_start(client):
    bookings = client.get(f"{API}/admin/bookings").json()

    assert bookings
    starts = [booking["startsAt"] for booking in bookings]
    assert starts == sorted(starts)


def test_every_booking_carries_event_type_summary(client):
    """Дозапросы клиенту не нужны: карточка типа события лежит внутри брони."""
    for booking in client.get(f"{API}/admin/bookings").json():
        assert set(booking["eventType"]) == {"id", "title", "durationMinutes"}
        assert {"id", "startsAt", "endsAt", "guest", "createdAt"} <= set(booking)


def test_list_mixes_all_event_types(client):
    ids = {b["eventType"]["id"] for b in client.get(f"{API}/admin/bookings").json()}

    assert len(ids) > 1


def test_past_bookings_are_hidden_by_default(client):
    now = datetime.now(timezone.utc)

    for booking in client.get(f"{API}/admin/bookings").json():
        assert datetime.fromisoformat(booking["startsAt"]) >= now


def test_range_filters_bookings(client):
    bookings = client.get(f"{API}/admin/bookings").json()
    second = datetime.fromisoformat(bookings[1]["startsAt"])

    from_second = client.get(
        f"{API}/admin/bookings", params={"from": second.isoformat()}
    ).json()
    before_second = client.get(
        f"{API}/admin/bookings", params={"to": second.isoformat()}
    ).json()

    # Нижняя граница включительно, верхняя — исключительно.
    assert from_second[0]["id"] == bookings[1]["id"]
    assert [b["id"] for b in before_second] == [bookings[0]["id"]]


def test_empty_range_returns_empty_list(client):
    far_future = datetime.now(timezone.utc) + timedelta(days=400)

    response = client.get(f"{API}/admin/bookings", params={"from": far_future.isoformat()})

    assert response.status_code == 200
    assert response.json() == []


def test_reversed_range_is_rejected(client):
    now = datetime.now(timezone.utc)

    response = client.get(
        f"{API}/admin/bookings",
        params={
            "from": (now + timedelta(days=5)).isoformat(),
            "to": (now + timedelta(days=1)).isoformat(),
        },
    )

    assert response.status_code == 400
    assert response.json()["code"] == "validation_failed"


def test_malformed_datetime_is_rejected(client):
    response = client.get(f"{API}/admin/bookings", params={"from": "позавчера"})

    assert response.status_code == 400
    assert response.json()["code"] == "validation_failed"


def test_guest_data_is_stored_as_sent(client):
    """То, чего не мог мок: в списке видно имя и почту, которые ввёл гость."""
    slot = first_free_slot(client, "konsultaciya")
    guest = {"name": "Ольга Пятница", "email": "olga.friday@example.com"}
    client.post(
        f"{API}/bookings",
        json=booking_payload("konsultaciya", slot["startsAt"], guest=guest),
    )

    bookings = client.get(f"{API}/admin/bookings").json()

    assert guest in [booking["guest"] for booking in bookings]
