"""Типы событий и календарь их свободных слотов."""

from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query

from ..errors import not_found, validation_failed
from ..models import ApiError, EventType, EventTypeCreate, SlotsPage
from ..scheduling import build_slots_page, window_bounds
from ..store import InMemoryStore, get_store

router = APIRouter(tags=["Типы событий"])


@router.get(
    "/event-types",
    response_model=list[EventType],
    operation_id="EventTypes_list",
    summary="Список типов событий для страницы с видами брони",
)
def list_event_types(store: InMemoryStore = Depends(get_store)) -> list[EventType]:
    return store.list_event_types()


@router.post(
    "/event-types",
    response_model=EventType,
    status_code=201,
    operation_id="EventTypes_create",
    summary="Создание типа события владельцем",
    responses={
        400: {"model": ApiError, "description": "400 — некорректный запрос."},
        409: {"model": ApiError, "description": "409 — тип события уже существует."},
    },
)
def create_event_type(
    payload: EventTypeCreate, store: InMemoryStore = Depends(get_store)
) -> EventType:
    """Идентификатор задаёт сам владелец, дубль — `409 event_type_exists`."""
    return store.add_event_type(payload)


@router.get(
    "/event-types/{id}",
    response_model=EventType,
    operation_id="EventTypes_read",
    summary="Карточка одного типа события",
    responses={404: {"model": ApiError, "description": "404 — ресурс не найден."}},
)
def read_event_type(id: str, store: InMemoryStore = Depends(get_store)) -> EventType:
    event_type = store.get_event_type(id)
    if event_type is None:
        raise not_found(f"Тип события «{id}» не найден.")
    return event_type


@router.get(
    "/event-types/{id}/slots",
    response_model=SlotsPage,
    operation_id="EventTypes_listSlots",
    summary="Календарь свободных слотов выбранного типа события",
    responses={
        400: {"model": ApiError, "description": "400 — некорректный запрос."},
        404: {"model": ApiError, "description": "404 — ресурс не найден."},
    },
)
def list_slots(
    id: str,
    from_: Optional[date] = Query(
        None,
        alias="from",
        description="Первый день диапазона включительно. По умолчанию — текущая дата.",
    ),
    to: Optional[date] = Query(
        None,
        description=(
            "Последний день диапазона включительно. "
            "По умолчанию — текущая дата плюс окно записи."
        ),
    ),
    store: InMemoryStore = Depends(get_store),
) -> SlotsPage:
    """
    Слоты строятся по рабочему расписанию владельца с шагом `slotStepMinutes`.

    Слот попадает в ответ, только если он полностью свободен: пересечения
    с бронированиями любых других типов событий исключают его из выдачи.
    Диапазон должен целиком лежать в окне записи.
    """
    event_type = store.get_event_type(id)
    if event_type is None:
        raise not_found(f"Тип события «{id}» не найден.")

    window_start, window_end = window_bounds()
    date_from = from_ or window_start
    date_to = to or window_end

    if date_from > date_to:
        raise validation_failed(
            "Начало диапазона позже его конца.",
            {"from": date_from.isoformat(), "to": date_to.isoformat()},
        )

    if date_from < window_start or date_to > window_end:
        raise validation_failed(
            "Диапазон выходит за окно записи.",
            {
                "from": date_from.isoformat(),
                "to": date_to.isoformat(),
                "window": {
                    "from": window_start.isoformat(),
                    "to": window_end.isoformat(),
                },
            },
        )

    return build_slots_page(event_type, date_from, date_to, store.busy_intervals())
