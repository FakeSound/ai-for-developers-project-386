"""
Схемы контракта.

Один в один повторяют модели из `openapi/openapi.yaml`: поля описаны в snake_case,
а на провод уходят в camelCase контракта через `alias_generator`. Ограничения
(паттерны, длины, границы чисел) перенесены из контракта, поэтому валидация
запросов достаётся бесплатно — FastAPI проверяет тело до входа в роутер.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from enum import Enum
from typing import Annotated, Any, Optional

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    PlainSerializer,
)
from pydantic.alias_generators import to_camel

# ---------------------------------------------------------------------------
# Общие типы
# ---------------------------------------------------------------------------


def to_utc_iso(value: datetime) -> str:
    """`datetime` -> строка UTC ISO-8601 без долей секунды: `2026-08-17T07:00:00Z`."""
    return (
        value.astimezone(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


#: Момент времени, который всегда сериализуется в UTC без долей секунды.
UtcDateTime = Annotated[datetime, PlainSerializer(to_utc_iso, return_type=str)]

EventTypeId = Annotated[
    str,
    Field(max_length=64, pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$"),
]
DurationMinutes = Annotated[int, Field(ge=5, le=480)]
TimeOfDay = Annotated[str, Field(pattern=r"^([01][0-9]|2[0-3]):[0-5][0-9]$")]


class Schema(BaseModel):
    """База для всех моделей контракта: snake_case внутри, camelCase снаружи."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


# ---------------------------------------------------------------------------
# Ошибки
# ---------------------------------------------------------------------------


class ErrorCode(str, Enum):
    """Машиночитаемая причина отказа."""

    validation_failed = "validation_failed"
    not_found = "not_found"
    event_type_exists = "event_type_exists"
    slot_taken = "slot_taken"
    slot_not_in_grid = "slot_not_in_grid"
    slot_out_of_window = "slot_out_of_window"


class ApiError(Schema):
    """Тело ответа при ошибке."""

    code: ErrorCode
    message: str
    details: Optional[dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Владелец
# ---------------------------------------------------------------------------


class Weekday(str, Enum):
    """День недели."""

    monday = "monday"
    tuesday = "tuesday"
    wednesday = "wednesday"
    thursday = "thursday"
    friday = "friday"
    saturday = "saturday"
    sunday = "sunday"


class Owner(Schema):
    """Владелец календаря — единственный заранее заданный профиль."""

    id: str
    name: Annotated[str, Field(min_length=1, max_length=100)]
    email: EmailStr
    time_zone: str
    workdays: list[Weekday]
    work_day_start: TimeOfDay
    work_day_end: TimeOfDay
    slot_step_minutes: Annotated[int, Field(ge=5, le=240)]
    booking_window_days: Annotated[int, Field(ge=1, le=365)]


# ---------------------------------------------------------------------------
# Типы событий
# ---------------------------------------------------------------------------


class EventTypeCreate(Schema):
    """Данные для создания типа события. Поле `createdAt` заполняет сервер."""

    id: EventTypeId
    title: Annotated[str, Field(min_length=1, max_length=100)]
    description: Annotated[str, Field(max_length=1000)]
    duration_minutes: DurationMinutes


class EventType(Schema):
    """Тип события — вид встречи, который владелец предлагает гостям."""

    id: EventTypeId
    title: Annotated[str, Field(min_length=1, max_length=100)]
    description: Annotated[str, Field(max_length=1000)]
    duration_minutes: DurationMinutes
    created_at: UtcDateTime


class EventTypeSummary(Schema):
    """Краткая карточка типа события внутри бронирования."""

    id: str
    title: str
    duration_minutes: int


# ---------------------------------------------------------------------------
# Гость и бронирования
# ---------------------------------------------------------------------------


class Guest(Schema):
    """Гость — человек, который бронирует встречу. Аккаунт не создаётся."""

    name: Annotated[str, Field(min_length=1, max_length=100)]
    email: EmailStr


class BookingCreate(Schema):
    """Данные для создания бронирования."""

    event_type_id: str
    starts_at: AwareDatetime
    guest: Guest
    notes: Optional[Annotated[str, Field(max_length=500)]] = None


class Booking(Schema):
    """Бронирование — занятый слот календаря."""

    id: str
    event_type: EventTypeSummary
    starts_at: UtcDateTime
    ends_at: UtcDateTime
    guest: Guest
    notes: Optional[Annotated[str, Field(max_length=500)]] = None
    created_at: UtcDateTime


# ---------------------------------------------------------------------------
# Слоты
# ---------------------------------------------------------------------------


class Slot(Schema):
    """Слот — отрезок времени на сетке владельца, доступный для записи."""

    starts_at: UtcDateTime
    ends_at: UtcDateTime


class DaySlots(Schema):
    """Свободные слоты одного календарного дня в часовом поясе владельца."""

    date: date
    slots: list[Slot]


class SlotsPage(Schema):
    """Календарь свободных слотов одного типа события за запрошенный диапазон."""

    event_type_id: str
    duration_minutes: int
    time_zone: str
    # `from` — ключевое слово Python, поэтому имя поля и алиас задаются вручную.
    from_: date = Field(alias="from")
    to: date
    days: list[DaySlots]
