"""
Сверка с контрактом.

`openapi/openapi.yaml` — источник правды. Тест ловит расхождение раньше,
чем оно доедет до фронтенда: набор операций и коды ошибок должны совпадать.
"""

from __future__ import annotations

from pathlib import Path

import yaml
from app.config import API_PREFIX
from app.main import app

CONTRACT = Path(__file__).resolve().parents[2] / "openapi" / "openapi.yaml"
METHODS = {"get", "post", "put", "patch", "delete"}


def contract() -> dict:
    return yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))


def operations(spec: dict, prefix: str = "") -> set[tuple[str, str, str]]:
    """Множество операций спеки: (путь без префикса, метод, operationId)."""
    found = set()
    for path, methods in spec["paths"].items():
        for method, operation in methods.items():
            if method in METHODS:
                found.add(
                    (
                        path[len(prefix) :] if prefix else path,
                        method,
                        operation["operationId"],
                    )
                )
    return found


def test_implements_exactly_the_contract_operations():
    assert operations(app.openapi(), API_PREFIX) == operations(contract())


def test_error_codes_match_the_contract():
    expected = set(contract()["components"]["schemas"]["ErrorCode"]["enum"])
    actual = set(app.openapi()["components"]["schemas"]["ErrorCode"]["enum"])

    assert actual == expected


def test_server_url_matches_the_api_prefix():
    url = contract()["servers"][0]["url"]

    assert url.endswith(API_PREFIX)
