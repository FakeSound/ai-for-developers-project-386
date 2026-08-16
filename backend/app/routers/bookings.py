"""Создание бронирования гостем."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ..errors import ApiException, not_found
from ..models import ApiError, Booking, BookingCreate, ErrorCode
from ..scheduling import as_utc, in_booking_window, is_on_grid
from ..store import InMemoryStore, get_store

router = APIRouter(tags=["Бронирования"])


@router.post(
    "/bookings",
    response_model=Booking,
    response_model_exclude_none=True,
    status_code=201,
    operation_id="Bookings_create",
    summary="Создание бронирования гостем",
    responses={
        400: {"model": ApiError, "description": "400 — некорректный запрос."},
        404: {"model": ApiError, "description": "404 — ресурс не найден."},
        409: {"model": ApiError, "description": "409 — конфликт с состоянием календаря."},
    },
)
def create_booking(
    payload: BookingCreate, store: InMemoryStore = Depends(get_store)
) -> Booking:
    """
    Аккаунт гостю не заводится — достаточно имени и почты.

    Проверки идут в порядке контракта: существование типа события, попадание
    на сетку, попадание в окно записи и только потом занятость календаря.
    Последняя проверка и вставка выполняются атомарно, поэтому `slot_taken`
    честно означает, что слот заняли между запросом календаря и отправкой формы.
    """
    event_type = store.get_event_type(payload.event_type_id)
    if event_type is None:
        raise not_found(f"Тип события «{payload.event_type_id}» не найден.")

    starts_at = as_utc(payload.starts_at)

    if not is_on_grid(starts_at, event_type.duration_minutes):
        raise ApiException(
            ErrorCode.slot_not_in_grid,
            "Выбранное время не совпадает с сеткой слотов владельца.",
            {"startsAt": starts_at.isoformat().replace("+00:00", "Z")},
        )

    if not in_booking_window(starts_at):
        raise ApiException(
            ErrorCode.slot_out_of_window,
            "Записаться можно только в пределах окна записи.",
            {"startsAt": starts_at.isoformat().replace("+00:00", "Z")},
        )

    return store.create_booking(event_type, starts_at, payload.guest, payload.notes)
