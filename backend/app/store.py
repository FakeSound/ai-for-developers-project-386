"""
Хранилище в памяти.

Отдельная база на этом шаге не нужна: типы событий и брони живут в процессе
и сбрасываются при перезапуске сервиса.

Мутации идут под локом. FastAPI выполняет синхронные эндпоинты в пуле потоков,
а проверка занятости и вставка брони обязаны быть одной атомарной операцией —
иначе два одновременных запроса на один слот оба увидят его свободным
и вместо `409 slot_taken` в календаре появятся две пересекающиеся встречи.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from threading import RLock
from typing import Optional

from .errors import ApiException
from .models import (
    Booking,
    ErrorCode,
    EventType,
    EventTypeCreate,
    EventTypeSummary,
    Guest,
)
from .scheduling import Interval, now_utc, overlaps


class InMemoryStore:
    """Типы событий и брони одного владельца."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._event_types: dict[str, EventType] = {}
        self._bookings: list[Booking] = []
        self._booking_counter = 0

    def reset(self) -> None:
        """Полная очистка. Нужна тестам, чтобы каждый начинался с чистого листа."""
        with self._lock:
            self._event_types.clear()
            self._bookings.clear()
            self._booking_counter = 0

    # -- Типы событий -------------------------------------------------------

    def list_event_types(self) -> list[EventType]:
        with self._lock:
            return sorted(self._event_types.values(), key=lambda t: t.created_at)

    def get_event_type(self, event_type_id: str) -> Optional[EventType]:
        with self._lock:
            return self._event_types.get(event_type_id)

    def add_event_type(
        self, payload: EventTypeCreate, created_at: Optional[datetime] = None
    ) -> EventType:
        """Идентификатор задаёт владелец, поэтому дубль — конфликт, а не ошибка ввода."""
        with self._lock:
            if payload.id in self._event_types:
                raise ApiException(
                    ErrorCode.event_type_exists,
                    f"Тип события «{payload.id}» уже существует.",
                    {"id": payload.id},
                )

            event_type = EventType(
                id=payload.id,
                title=payload.title,
                description=payload.description,
                duration_minutes=payload.duration_minutes,
                created_at=created_at or now_utc(),
            )
            self._event_types[event_type.id] = event_type
            return event_type

    # -- Бронирования -------------------------------------------------------

    def list_bookings(
        self, date_from: Optional[datetime] = None, date_to: Optional[datetime] = None
    ) -> list[Booking]:
        """Брони всех типов событий одним списком, по возрастанию `startsAt`."""
        with self._lock:
            selected = [
                booking
                for booking in self._bookings
                if (date_from is None or booking.starts_at >= date_from)
                and (date_to is None or booking.starts_at < date_to)
            ]
        return sorted(selected, key=lambda b: b.starts_at)

    def busy_intervals(self) -> list[Interval]:
        """Занятые интервалы календаря — общие для всех типов событий."""
        with self._lock:
            return [(b.starts_at, b.ends_at) for b in self._bookings]

    def create_booking(
        self,
        event_type: EventType,
        starts_at: datetime,
        guest: Guest,
        notes: Optional[str] = None,
        created_at: Optional[datetime] = None,
    ) -> Booking:
        """
        Создаёт бронь, если время свободно.

        Проверка занятости и вставка выполняются под одним локом.
        """
        ends_at = starts_at + timedelta(minutes=event_type.duration_minutes)

        with self._lock:
            if overlaps(starts_at, ends_at, self.busy_intervals()):
                raise ApiException(
                    ErrorCode.slot_taken,
                    "Это время уже занято. Выберите другой слот.",
                    {"startsAt": starts_at.isoformat().replace("+00:00", "Z")},
                )

            self._booking_counter += 1
            booking = Booking(
                id=f"bkg-{self._booking_counter:04d}",
                event_type=EventTypeSummary(
                    id=event_type.id,
                    title=event_type.title,
                    duration_minutes=event_type.duration_minutes,
                ),
                starts_at=starts_at,
                ends_at=ends_at,
                guest=guest,
                notes=notes,
                created_at=created_at or now_utc(),
            )
            self._bookings.append(booking)
            return booking


#: Один экземпляр на процесс.
store = InMemoryStore()


def get_store() -> InMemoryStore:
    """Зависимость FastAPI: роутеры не знают, как именно устроено хранилище."""
    return store
