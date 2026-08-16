"""
Сборка приложения.

Бэкенд отвечает по адресам контракта (`openapi/openapi.yaml`) на том же порту,
где раньше жил мок Prism, поэтому фронтенду хватает флага `VITE_MOCK=false`.

Ни одна операция не требует авторизации: владелец — заранее заданный профиль,
гость анонимен. Админская часть отличается только маршрутом.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import API_PREFIX, FRONTEND_ORIGINS
from .errors import MESSAGE_BY_CODE, ApiException
from .models import ApiError, ErrorCode
from .routers import admin, bookings, event_types, owner
from .seed import seed
from .store import store

DESCRIPTION = """
HTTP API сервиса бронирования встреч.

Данные живут в памяти процесса и сбрасываются при перезапуске сервиса.
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Хранилище наполняется демо-данными при каждом запуске."""
    store.reset()
    seed(store)
    yield


app = FastAPI(
    title="AICalls Booking API",
    description=DESCRIPTION,
    # Версию ведёт release-please, маркер в комментарии — его якорь.
    version="0.1.0",  # x-release-please-version
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Ошибки в форме контракта
# ---------------------------------------------------------------------------


def error_response(
    status_code: int, code: ErrorCode, message: str, details: dict | None = None
) -> JSONResponse:
    body = ApiError(code=code, message=message, details=details)
    return JSONResponse(
        status_code=status_code,
        content=body.model_dump(mode="json", by_alias=True, exclude_none=True),
    )


@app.exception_handler(ApiException)
async def handle_api_exception(_: Request, exc: ApiException) -> JSONResponse:
    return error_response(exc.status_code, exc.code, exc.message, exc.details)


@app.exception_handler(RequestValidationError)
async def handle_validation_error(
    _: Request, exc: RequestValidationError
) -> JSONResponse:
    """
    Контракт знает только `400 validation_failed`, поэтому дефолтный 422
    от FastAPI подменяется на контрактный ответ со списком проблемных полей.
    """
    fields = [
        {
            "field": ".".join(str(part) for part in error["loc"][1:]) or "body",
            "message": error["msg"],
            "type": error["type"],
        }
        for error in exc.errors()
    ]
    return error_response(
        400,
        ErrorCode.validation_failed,
        MESSAGE_BY_CODE[ErrorCode.validation_failed],
        {"fields": fields},
    )


@app.exception_handler(StarletteHTTPException)
async def handle_http_exception(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Неизвестный маршрут тоже должен выглядеть как ошибка контракта."""
    if exc.status_code == 404:
        return error_response(
            404, ErrorCode.not_found, "Ресурс не найден.", {"detail": str(exc.detail)}
        )
    return error_response(
        exc.status_code,
        ErrorCode.validation_failed,
        str(exc.detail),
    )


# ---------------------------------------------------------------------------
# Маршруты
# ---------------------------------------------------------------------------

app.include_router(owner.router, prefix=API_PREFIX)
app.include_router(event_types.router, prefix=API_PREFIX)
app.include_router(bookings.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)
