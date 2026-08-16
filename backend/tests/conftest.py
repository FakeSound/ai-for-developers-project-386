"""
Общие фикстуры и помощники.

Время не замораживается: тесты берут реальные слоты из календаря и бронируют
их, а негативные случаи конструируют явно от сегодняшней даты владельца.
Так проверяется тот же код, что работает в проде, включая границы окна записи.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Optional

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.scheduling import is_workday, owner_today, owner_wall_time

API = "/api/v1"


@pytest.fixture
def client() -> TestClient:
    """Клиент с чистым, заново засеянным хранилищем: lifespan отрабатывает на входе."""
    with TestClient(app) as test_client:
        yield test_client


# ---------------------------------------------------------------------------
# Помощники
# ---------------------------------------------------------------------------


def slots_page(client: TestClient, event_type_id: str, **params: Any) -> dict:
    response = client.get(f"{API}/event-types/{event_type_id}/slots", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def first_free_slot(client: TestClient, event_type_id: str) -> dict:
    """Первый свободный слот окна — он же самый ранний в своём дне."""
    for day in slots_page(client, event_type_id)["days"]:
        if day["slots"]:
            return day["slots"][0]
    raise AssertionError(f"нет свободных слотов для {event_type_id}")


def all_slot_starts(page: dict) -> list[str]:
    return [slot["startsAt"] for day in page["days"] for slot in day["slots"]]


def booking_payload(
    event_type_id: str, starts_at: str, notes: Optional[str] = None, **overrides: Any
) -> dict:
    payload: dict[str, Any] = {
        "eventTypeId": event_type_id,
        "startsAt": starts_at,
        "guest": {"name": "Иван Гость", "email": "ivan@example.com"},
    }
    if notes is not None:
        payload["notes"] = notes
    payload.update(overrides)
    return payload


def to_iso(moment: datetime) -> str:
    return moment.isoformat().replace("+00:00", "Z")


def shifted(starts_at: str, **delta: int) -> str:
    """Сдвигает момент из ответа API: `shifted(slot, minutes=7)`."""
    return to_iso(datetime.fromisoformat(starts_at) + timedelta(**delta))


def workday_near(anchor: date, step: int) -> date:
    """Ближайший рабочий день от `anchor` в сторону `step` (включая сам anchor)."""
    day = anchor
    while not is_workday(day):
        day += timedelta(days=step)
    return day


def workday_wall_time(days_from_today: int, time_of_day: str = "11:00") -> str:
    """Рабочий день в N днях от сегодня, время по поясу владельца -> UTC ISO."""
    anchor = owner_today() + timedelta(days=days_from_today)
    day = workday_near(anchor, 1 if days_from_today >= 0 else -1)
    return to_iso(owner_wall_time(day, time_of_day))


def weekend_wall_time(time_of_day: str = "11:00") -> str:
    """Ближайший нерабочий день окна, время по поясу владельца -> UTC ISO."""
    day = owner_today()
    for _ in range(14):
        if not is_workday(day):
            return to_iso(owner_wall_time(day, time_of_day))
        day += timedelta(days=1)
    raise AssertionError("в окне записи нет выходных")
