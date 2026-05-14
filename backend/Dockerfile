ARG PYTHON_BASE_IMAGE=public.ecr.aws/docker/library/python:3.12-slim

FROM ${PYTHON_BASE_IMAGE} AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    POETRY_HOME="/opt/poetry" \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1

ENV PATH="$POETRY_HOME/bin:$PATH"

RUN pip install --no-cache-dir "poetry==2.1.2"

# ── builder ──────────────────────────────────────────────────────────────────
FROM base AS builder

WORKDIR /app

COPY pyproject.toml poetry.lock* ./
RUN poetry install --only=main --no-root

# ── runtime ───────────────────────────────────────────────────────────────────
FROM ${PYTHON_BASE_IMAGE} AS runtime

RUN apt-get clean && apt-get update && (DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-pol \
    poppler-utils \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    fonts-liberation \
    fonts-dejavu-core \
    || apt-get -f install) \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY . .

RUN adduser --disabled-password --gecos "" --no-create-home appuser \
    && chown -R appuser:appuser /app \
    && mkdir -p /home/appuser/.cache/fontconfig \
    && chown -R appuser:appuser /home/appuser

ENV HOME=/home/appuser \
    XDG_CACHE_HOME=/home/appuser/.cache

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
