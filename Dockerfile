# Приложение целиком в одном образе: фронтенд собирается на первой стадии,
# а отдаёт его — вместе с API — тот же процесс uvicorn. Один порт наружу,
# браузер ходит на один origin, отдельного nginx нет.
#
# Порт берётся из переменной окружения PORT: так запускает и Render,
# и автоматическая проверка проекта.
#
#   docker build -t aicalls .
#   docker run --rm -e PORT=8080 -p 8080:8080 aicalls

# ---------------------------------------------------------------------------
# Сборка фронтенда
# ---------------------------------------------------------------------------
#
# Компиляция TypeSpec сюда не входит: и openapi/openapi.yaml, и
# frontend/src/api/schema.d.ts лежат в репозитории, так что сборка
# самодостаточна. После правки main.tsp нужен `npm run gen:api`.

FROM node:22-alpine AS web

WORKDIR /web

# Зависимости отдельным слоем: пересобираются только при смене lock-файла.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# ---------------------------------------------------------------------------
# Рантайм
# ---------------------------------------------------------------------------

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /srv

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app

# Рядом с пакетом: app/web.py ищет сборку по этому пути.
COPY --from=web /web/dist ./static

RUN useradd --create-home --uid 1000 app && chown -R app:app /srv
USER app

# Справочно: реальный порт приходит в PORT, значение ниже — лишь значение
# по умолчанию для локального запуска без переменной.
EXPOSE 3000

# Форма с sh обязательна: в exec-форме ${PORT} остался бы строкой. Само
# `exec` нужно, чтобы uvicorn стал первым процессом и получал сигналы
# остановки от Docker.
#
# --host 0.0.0.0 — иначе снаружи контейнера сервис не виден;
# --forwarded-allow-ips — на Render перед контейнером стоит прокси с TLS.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-3000} --forwarded-allow-ips '*'"]
