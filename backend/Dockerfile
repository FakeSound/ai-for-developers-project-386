# Бэкенд на FastAPI. Наружу порт не публикуется: контейнер виден только
# фронтенду по имени сервиса внутри сети compose.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /srv

# Зависимости отдельным слоем: код меняется чаще, чем requirements.txt.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

RUN useradd --create-home --uid 1000 app && chown -R app:app /srv
USER app

EXPOSE 3000

# --host 0.0.0.0 обязателен: на 127.0.0.1 процесс не был бы виден из сети compose.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3000"]
