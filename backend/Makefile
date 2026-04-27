.PHONY: help install run test lint format typecheck security migrate makemigration check \
	up docker-up docker-down docker-build docker-logs docker-logs-ad docker-migrate minio-init

help:
	@echo "HRK Backend - Available commands:"
	@echo ""
	@echo "  Development:"
	@echo "  make install        - Install dependencies with Poetry"
	@echo "  make run            - Run the application locally"
	@echo "  make test           - Run pytest"
	@echo "  make lint           - Run ruff linter"
	@echo "  make format         - Format code with ruff"
	@echo "  make typecheck      - Run mypy type checking"
	@echo "  make security       - Run bandit security check"
	@echo "  make migrate        - Apply database migrations"
	@echo "  make makemigration  - Create new migration (usage: make makemigration MSG='add users table')"
	@echo "  make check          - Run all checks (lint + typecheck + test + security)"
	@echo ""
	@echo "  Docker:"
	@echo "  make up             - Build and start backend stack"
	@echo "  make docker-up      - Start backend stack without rebuilding"
	@echo "  make docker-down    - Stop and remove containers"
	@echo "  make docker-build   - Rebuild all images"
	@echo "  make docker-logs    - Tail API logs"
	@echo "  make docker-logs-ad - Tail AD microservice logs"
	@echo "  make docker-migrate - Run alembic migrations inside the api container"
	@echo "  make minio-init     - Create default S3 bucket in MinIO (auto-run on docker-up)"

install:
	poetry install

run:
	PYTHONPATH=src poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test:
	PYTHONPATH=src poetry run pytest

lint:
	poetry run ruff check src

format:
	poetry run ruff format src

typecheck:
	PYTHONPATH=src poetry run mypy src/app

security:
	poetry run bandit -r src/app

migrate:
	PYTHONPATH=src poetry run alembic upgrade head

makemigration:
	PYTHONPATH=src poetry run alembic revision --autogenerate -m "$(MSG)"

check: lint typecheck test security
	@echo "All checks passed"

# ── Docker targets ─────────────────────────────────────────────────────────────

up:
	docker compose up -d --build

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-build:
	docker compose build

docker-logs:
	docker compose logs -f api

docker-logs-ad:
	docker compose logs -f ad

docker-migrate:
	docker compose exec api alembic upgrade head

minio-init:
	docker compose run --rm minio-init
