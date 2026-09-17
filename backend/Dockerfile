ARG PYTHON_BASE_IMAGE=git.hrk.pl:3000/pypi-local/python:3.12-slim

FROM ${PYTHON_BASE_IMAGE} AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_INDEX_URL=https://git.hrk.pl:3000/api/packages/pypi-local/pypi/simple/ \
    PIP_NO_CACHE_DIR=1

# ── builder ──────────────────────────────────────────────────────────────────
FROM base AS builder

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

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

COPY --from=builder /install /usr/local

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
