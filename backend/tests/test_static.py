"""
Раздача собранного фронтенда.

Сборки в репозитории нет — она появляется только внутри Docker-образа,
поэтому статика подкладывается во временный каталог, а приложение для проверки
собирается отдельное: у общего `app` из `main.py` статика не смонтирована.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from app.errors import ApiException
from app.main import error_response
from app.web import mount_static
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

INDEX = "<!doctype html><title>AICalls</title>"
BUNDLE = "console.log('bundle')"


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    """Приложение со сборкой фронтенда во временном каталоге."""
    (tmp_path / "index.html").write_text(INDEX, encoding="utf-8")
    (tmp_path / "favicon.svg").write_text("<svg/>", encoding="utf-8")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app-abc123.js").write_text(BUNDLE, encoding="utf-8")

    app = FastAPI()

    # Тот же обработчик, что в main.py: без него отказ контракта улетел бы
    # необработанным исключением.
    @app.exception_handler(ApiException)
    async def handle_api_exception(_: Request, exc: ApiException) -> JSONResponse:
        return error_response(exc.status_code, exc.code, exc.message, exc.details)

    assert mount_static(app, tmp_path)

    with TestClient(app) as test_client:
        yield test_client


def test_root_serves_the_spa_shell(client):
    response = client.get("/")

    assert response.status_code == 200
    assert response.text == INDEX


def test_browser_route_falls_back_to_the_spa_shell(client):
    """Прямой заход на /admin: маршрут знает только react-router."""
    response = client.get("/admin")

    assert response.status_code == 200
    assert response.text == INDEX


def test_asset_is_served_with_an_immutable_cache(client):
    response = client.get("/assets/app-abc123.js")

    assert response.status_code == 200
    assert response.text == BUNDLE
    assert response.headers["cache-control"] == "public, max-age=31536000, immutable"


def test_public_file_is_served_as_is(client):
    response = client.get("/favicon.svg")

    assert response.status_code == 200
    assert response.text == "<svg/>"


def test_unknown_api_path_stays_a_contract_error(client):
    """Под /api/v1 клиент ждёт JSON, а не оболочку приложения."""
    response = client.get("/api/v1/nope")

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


def test_missing_build_leaves_the_app_untouched(tmp_path: Path):
    """Без сборки приложение остаётся чистым API: catch-all не появляется."""
    app = FastAPI()

    assert mount_static(app, tmp_path / "dist") is False

    with TestClient(app) as test_client:
        assert test_client.get("/").status_code == 404
