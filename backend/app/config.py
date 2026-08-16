"""
Настройки сервиса.

Профиль владельца создаётся при развёртывании и через API не изменяется —
контракт не предусматривает операций записи для него. Значения совпадают
с мок-данными (`mock/dataset.mjs`), чтобы поведение бэкенда и мока
не расходилось на глазах у фронтенда.
"""

from __future__ import annotations

from .models import Owner, Weekday

#: Базовый путь API, совпадает с `servers.url` из контракта.
API_PREFIX = "/api/v1"

#: Origin фронтенда в разработке — для CORS при прямых запросах мимо Vite-прокси.
FRONTEND_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]

OWNER = Owner(
    id="owner-1",
    name="Анна Смирнова",
    email="anna@aicalls.dev",
    time_zone="Europe/Moscow",
    workdays=[
        Weekday.monday,
        Weekday.tuesday,
        Weekday.wednesday,
        Weekday.thursday,
        Weekday.friday,
    ],
    work_day_start="10:00",
    work_day_end="18:00",
    slot_step_minutes=30,
    booking_window_days=14,
)
