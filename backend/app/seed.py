"""
Демо-данные, которыми хранилище наполняется при старте.

Перенос `mock/dataset.mjs`: те же типы событий и те же брони, чтобы после
перехода с мока на бэкенд экраны выглядели знакомо, а правило глобальной
занятости было видно сразу — часть слотов уже занята.

Всё считается относительно текущего момента, поэтому окно записи всегда
начинается с сегодняшнего дня и данные не протухают.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import NamedTuple, Optional

from .errors import ApiException
from .models import EventTypeCreate, Guest
from .scheduling import is_workday, now_utc, owner_wall_time, window_days
from .store import InMemoryStore

EVENT_TYPES = [
    (
        EventTypeCreate(
            id="znakomstvo",
            title="Знакомство",
            description=(
                "Короткая встреча, чтобы познакомиться, обсудить вашу задачу "
                "и понять, чем я могу помочь. Без подготовки — просто расскажите, "
                "что у вас происходит."
            ),
            duration_minutes=30,
        ),
        45,
    ),
    (
        EventTypeCreate(
            id="konsultaciya",
            title="Консультация",
            description=(
                "Разбираем вашу задачу предметно: архитектура, процессы, найм "
                "или что-то ещё из моей области. К встрече лучше прислать вводные "
                "заранее — так успеем больше."
            ),
            duration_minutes=60,
        ),
        30,
    ),
    (
        EventTypeCreate(
            id="bystryj-zvonok",
            title="Быстрый звонок",
            description=(
                "Пятнадцать минут на один конкретный вопрос. Подходит, если нужно "
                "быстро свериться или получить короткий ответ, а полноценная "
                "встреча избыточна."
            ),
            duration_minutes=15,
        ),
        12,
    ),
]


class BookingSeed(NamedTuple):
    """Бронь ставится на N-й рабочий день окна, а не на N-й календарный."""

    workday_index: int
    time: str
    event_type_id: str
    guest: Guest
    notes: Optional[str] = None


BOOKING_SEEDS = [
    BookingSeed(
        0,
        "11:00",
        "znakomstvo",
        Guest(name="Игорь Ковалёв", email="igor.kovalev@example.com"),
        "Хочу обсудить переход с монолита на сервисы.",
    ),
    BookingSeed(
        0,
        "15:00",
        "konsultaciya",
        Guest(name="Мария Титова", email="m.titova@example.com"),
    ),
    BookingSeed(
        1,
        "10:30",
        "bystryj-zvonok",
        Guest(name="Павел Дорохов", email="pavel@example.com"),
        "Один вопрос по код-ревью.",
    ),
    BookingSeed(
        3,
        "14:00",
        "konsultaciya",
        Guest(name="Ольга Бирюкова", email="olga.b@example.com"),
        "Нужен разбор процесса найма в команду из пяти человек.",
    ),
    BookingSeed(
        5,
        "12:00",
        "znakomstvo",
        Guest(name="艾 Чен", email="ai.chen@example.com"),
    ),
    BookingSeed(
        7,
        "16:30",
        "znakomstvo",
        Guest(name="Дмитрий Валеев", email="d.valeev@example.com"),
    ),
]


def _workdays_of_window() -> list[date]:
    return [day for day in window_days() if is_workday(day)]


def seed(store: InMemoryStore) -> None:
    """Наполняет хранилище демо-данными. Ожидает пустое хранилище."""
    now = now_utc()

    for payload, days_ago in EVENT_TYPES:
        store.add_event_type(payload, created_at=now - timedelta(days=days_ago))

    workdays = _workdays_of_window()

    for index, booking_seed in enumerate(BOOKING_SEEDS):
        if booking_seed.workday_index >= len(workdays):
            continue

        day = workdays[booking_seed.workday_index]
        starts_at = owner_wall_time(day, booking_seed.time)

        # В отличие от мока прошедшее время не засеваем: такая бронь не видна
        # в списке предстоящих встреч и только глушит уже недоступный слот.
        if starts_at <= now:
            continue

        event_type = store.get_event_type(booking_seed.event_type_id)
        if event_type is None:
            continue

        try:
            store.create_booking(
                event_type,
                starts_at,
                booking_seed.guest,
                booking_seed.notes,
                created_at=now - timedelta(days=index + 2),
            )
        except ApiException:
            # Сид пересёкся с уже созданным — пропускаем, календарь важнее демо-данных.
            continue
