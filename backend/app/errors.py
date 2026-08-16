"""
Отказы в терминах контракта.

Единственный способ вернуть ошибку из роутера — бросить `ApiException`.
Обработчики в `main.py` превращают её в тело `ApiError`, поэтому клиент
всегда получает одинаковую форму: `{ code, message, details? }`.
"""

from __future__ import annotations

from typing import Any, Optional

from .models import ErrorCode

#: Сообщения по умолчанию. Фронтенд подставляет свои, если поле пустое,
#: но осмысленный текст полезен и в curl, и в Swagger UI.
MESSAGE_BY_CODE: dict[ErrorCode, str] = {
    ErrorCode.validation_failed: "Запрос не прошёл валидацию.",
    ErrorCode.not_found: "Ресурс не найден.",
    ErrorCode.event_type_exists: "Тип события с таким идентификатором уже существует.",
    ErrorCode.slot_taken: "Это время уже занято. Выберите другой слот.",
    ErrorCode.slot_not_in_grid: "Выбранное время не совпадает с сеткой слотов владельца.",
    ErrorCode.slot_out_of_window: "Записаться можно только в пределах окна записи.",
}

#: HTTP-статус для каждого кода: контракт закрепляет их за конкретными ответами.
STATUS_BY_CODE: dict[ErrorCode, int] = {
    ErrorCode.validation_failed: 400,
    ErrorCode.not_found: 404,
    ErrorCode.event_type_exists: 409,
    ErrorCode.slot_taken: 409,
    ErrorCode.slot_not_in_grid: 409,
    ErrorCode.slot_out_of_window: 409,
}


class ApiException(Exception):
    """Контрактный отказ. Статус выводится из кода ошибки."""

    def __init__(
        self,
        code: ErrorCode,
        message: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        self.code = code
        self.message = message or MESSAGE_BY_CODE[code]
        self.details = details
        self.status_code = STATUS_BY_CODE[code]
        super().__init__(self.message)


def not_found(message: str) -> ApiException:
    return ApiException(ErrorCode.not_found, message)


def validation_failed(
    message: str, details: Optional[dict[str, Any]] = None
) -> ApiException:
    return ApiException(ErrorCode.validation_failed, message, details)
