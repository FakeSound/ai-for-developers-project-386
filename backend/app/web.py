"""
Раздача собранного фронтенда.

В продакшене приложение живёт одним процессом: тот же uvicorn, что отвечает
по адресам контракта, отдаёт и статику из `frontend/dist`. Отдельного nginx
нет, поэтому его правила переехали сюда — вечный кэш для хэшированных файлов
и SPA-fallback для маршрутов react-router.

Каталог со сборкой появляется только в Docker-образе. В разработке и в тестах
его нет: `mount_static` в этом случае ничего не делает, и приложение остаётся
чистым API, как раньше.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response

from .config import API_PREFIX
from .errors import not_found

#: Куда Dockerfile кладёт сборку фронтенда. Путь можно переопределить
#: переменной окружения — тем же способом задаётся и `PORT`.
STATIC_DIR = Path(
    os.environ.get("STATIC_DIR", Path(__file__).resolve().parent.parent / "static")
)


class ImmutableStatic(StaticFiles):
    """Статика с вечным кэшем: имена файлов Vite хэширует по содержимому."""

    def file_response(self, *args: Any, **kwargs: Any) -> Response:
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


def mount_static(app: FastAPI, directory: Path = STATIC_DIR) -> bool:
    """
    Добавляет раздачу статики. Возвращает `False`, если сборки нет.

    Вызывать только после `include_router`: catch-all перехватывает любой путь,
    и маршруты контракта должны быть зарегистрированы раньше него.
    """
    index = directory / "index.html"
    if not index.is_file():
        return False

    app.mount(
        "/assets",
        ImmutableStatic(directory=directory / "assets"),
        name="assets",
    )

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str) -> FileResponse:
        """Файл из сборки, а для неизвестного пути — `index.html`."""
        # Неизвестный адрес API — ошибка контракта, а не страница приложения:
        # иначе клиент получил бы HTML там, где ждёт JSON.
        if f"/{path}".startswith(API_PREFIX):
            raise not_found("Ресурс не найден.")

        candidate = (directory / path).resolve()
        # is_relative_to отсекает выход за пределы каталога через `..`.
        if candidate.is_file() and candidate.is_relative_to(directory.resolve()):
            return FileResponse(candidate)

        # Маршруты вроде /admin существуют только в браузере: отдаём оболочку
        # SPA, дальше разбирается react-router.
        return FileResponse(index)

    return True
