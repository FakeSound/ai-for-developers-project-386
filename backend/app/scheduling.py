"""
Сетка слотов и правила времени.

Чистые функции без состояния: всё, что связано с расписанием владельца,
окном записи и проверками времени, считается здесь, а хранилище и роутеры
только пользуются результатом.

Настенное время владельца переводится в UTC через `zoneinfo`, поэтому
переходы на летнее время учитываются для конкретной даты, а не фиксированным
смещением.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Iterable, Optional
from zoneinfo import ZoneInfo

from .config import OWNER
from .models import DaySlots, EventType, Slot, SlotsPage, Weekday

#: `date.weekday()`: 0 — понедельник.
WEEKDAY_BY_INDEX = [
    Weekday.monday,
    Weekday.tuesday,
    Weekday.wednesday,
    Weekday.thursday,
    Weekday.friday,
    Weekday.saturday,
    Weekday.sunday,
]

#: Занятый интервал календаря: полуинтервал [начало, конец).
Interval = tuple[datetime, datetime]


def owner_tz() -> ZoneInfo:
    return ZoneInfo(OWNER.time_zone)


def now_utc() -> datetime:
    """Текущий момент в UTC без долей секунды — в них нет смысла на сетке слотов."""
    return datetime.now(timezone.utc).replace(microsecond=0)


def as_utc(value: datetime) -> datetime:
    """Приводит момент к UTC; наивное время считается уже заданным в UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


# ---------------------------------------------------------------------------
# Окно записи
# ---------------------------------------------------------------------------


def owner_today() -> date:
    """Сегодняшняя календарная дата в часовом поясе владельца."""
    return datetime.now(owner_tz()).date()


def window_bounds() -> tuple[date, date]:
    """
    Границы окна записи включительно: сегодня .. сегодня + `bookingWindowDays`.

    Обе даты — календарные, в поясе владельца.
    """
    today = owner_today()
    return today, today + timedelta(days=OWNER.booking_window_days)


# ---------------------------------------------------------------------------
# Сетка слотов
# ---------------------------------------------------------------------------


def _minutes_of_day(value: str) -> int:
    """`"10:30"` -> 630."""
    hours, minutes = value.split(":")
    return int(hours) * 60 + int(minutes)


def _wall_time_to_utc(day: date, minutes_from_midnight: int) -> datetime:
    """Настенное время владельца -> момент UTC."""
    local = datetime.combine(day, time(), tzinfo=owner_tz()) + timedelta(
        minutes=minutes_from_midnight
    )
    return local.astimezone(timezone.utc)


def owner_wall_time(day: date, time_of_day: str) -> datetime:
    """`("2026-08-17", "11:00")` в поясе владельца -> момент UTC."""
    return _wall_time_to_utc(day, _minutes_of_day(time_of_day))


def is_workday(day: date) -> bool:
    return WEEKDAY_BY_INDEX[day.weekday()] in OWNER.workdays


def window_days() -> list[date]:
    """Все календарные дни окна записи, по возрастанию."""
    start, end = window_bounds()
    days: list[date] = []
    day = start
    while day <= end:
        days.append(day)
        day += timedelta(days=1)
    return days


def slot_starts(
    day: date,
    duration_minutes: int,
    *,
    future_only: bool = True,
    now: Optional[datetime] = None,
) -> list[datetime]:
    """
    Начала слотов дня в UTC.

    Слот существует, только если день рабочий, начало кратно шагу сетки от
    `workDayStart`, а конец не выходит за `workDayEnd`. По умолчанию прошедшие
    слоты отбрасываются: записаться на них нельзя. Для проверки «время лежит
    на сетке» прошлое, наоборот, нужно учитывать — иначе вчерашние 11:00
    выглядели бы как время не по сетке, хотя они просто вне окна записи.
    """
    if not is_workday(day):
        return []

    moment = now or now_utc()
    day_start = _minutes_of_day(OWNER.work_day_start)
    day_end = _minutes_of_day(OWNER.work_day_end)

    starts: list[datetime] = []
    minute = day_start
    while minute + duration_minutes <= day_end:
        starts_at = _wall_time_to_utc(day, minute)
        if future_only and starts_at <= moment:
            minute += OWNER.slot_step_minutes
            continue
        starts.append(starts_at)
        minute += OWNER.slot_step_minutes
    return starts


def is_on_grid(starts_at: datetime, duration_minutes: int) -> bool:
    """Совпадает ли момент с началом слота на сетке владельца."""
    local_day = starts_at.astimezone(owner_tz()).date()
    return starts_at in slot_starts(local_day, duration_minutes, future_only=False)


def in_booking_window(starts_at: datetime, now: Optional[datetime] = None) -> bool:
    """Лежит ли момент в окне записи: от текущего момента до конца окна."""
    moment = now or now_utc()
    if starts_at <= moment:
        return False
    _, window_end = window_bounds()
    return starts_at.astimezone(owner_tz()).date() <= window_end


# ---------------------------------------------------------------------------
# Занятость
# ---------------------------------------------------------------------------


def overlaps(start: datetime, end: datetime, busy: Iterable[Interval]) -> bool:
    """
    Пересекается ли отрезок с занятыми интервалами календаря.

    Занятость глобальная: `busy` приходит по всем типам событий сразу.
    """
    return any(start < busy_end and end > busy_start for busy_start, busy_end in busy)


def build_slots_page(
    event_type: EventType,
    date_from: date,
    date_to: date,
    busy: Iterable[Interval],
) -> SlotsPage:
    """Календарь свободных слотов типа события за диапазон дат включительно."""
    duration = event_type.duration_minutes
    busy_intervals = list(busy)
    moment = now_utc()

    days: list[DaySlots] = []
    day = date_from
    while day <= date_to:
        slots = []
        for starts_at in slot_starts(day, duration, now=moment):
            ends_at = starts_at + timedelta(minutes=duration)
            if overlaps(starts_at, ends_at, busy_intervals):
                continue
            slots.append(Slot(starts_at=starts_at, ends_at=ends_at))
        # Дни без свободных слотов тоже попадают в выдачу — с пустым массивом.
        days.append(DaySlots(date=day, slots=slots))
        day += timedelta(days=1)

    return SlotsPage(
        event_type_id=event_type.id,
        duration_minutes=duration,
        time_zone=OWNER.time_zone,
        from_=date_from,
        to=date_to,
        days=days,
    )
