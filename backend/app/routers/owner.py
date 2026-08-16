"""Профиль владельца календаря."""

from __future__ import annotations

from fastapi import APIRouter

from ..config import OWNER
from ..models import Owner

router = APIRouter(tags=["Владелец"])


@router.get(
    "/owner",
    response_model=Owner,
    operation_id="OwnerProfile_read",
    summary="Профиль владельца календаря и правила формирования слотов",
)
def read_owner() -> Owner:
    """
    Профиль создаётся при развёртывании сервиса и через API не изменяется.

    Публичная страница берёт отсюда имя и часовой пояс, админская часть
    работает от этого профиля по умолчанию.
    """
    return OWNER
