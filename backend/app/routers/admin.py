"""Админская часть: страница предстоящих встреч владельца."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query

from ..errors import validation_failed
from ..models import ApiError, Booking
from ..scheduling import as_utc, now_utc
from ..store import InMemoryStore, get_store

router = APIRouter(tags=["Админская часть"])


@router.get(
    "/admin/bookings",
    response_model=list[Booking],
    response_model_exclude_none=True,
    operation_id="AdminBookings_list",
    summary="Страница предстоящих встреч владельца",
    responses={400: {"model": ApiError, "description": "400 — некорректный запрос."}},
)
def list_bookings(
    from_: Optional[datetime] = Query(
        None,
        alias="from",
        description="Нижняя граница выборки включительно, UTC. По умолчанию — текущий момент.",
    ),
    to: Optional[datetime] = Query(
        None,
        description="Верхняя граница выборки исключительно, UTC. По умолчанию не ограничена.",
    ),
    store: InMemoryStore = Depends(get_store),
) -> list[Booking]:
    """
    Один список бронирований всех типов событий, по возрастанию `startsAt`.

    Каждая запись содержит краткую карточку типа события, поэтому дозапросы
    клиенту не нужны.
    """
    date_from = as_utc(from_) if from_ is not None else now_utc()
    date_to = as_utc(to) if to is not None else None

    if date_to is not None and date_from > date_to:
        raise validation_failed(
            "Начало диапазона позже его конца.",
            {"from": date_from.isoformat(), "to": date_to.isoformat()},
        )

    return store.list_bookings(date_from, date_to)
