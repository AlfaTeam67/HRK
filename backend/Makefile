.PHONY: help install run test lint format typecheck security migrate makemigration check

help:
	@echo "HRK Backend - Available commands:"
	@echo "  make install        - Install dependencies with Poetry"
	@echo "  make run            - Run the application locally"
	@echo "  make test           - Run pytest"
	@echo "  make lint           - Run ruff linter"
	@echo "  make format         - Format code with ruff"
	@echo "  make typecheck      - Run mypy type checking"
	@echo "  make security       - Run bandit security check"
	@echo "  make migrate        - Apply database migrations"
	@echo "  make makemigration  - Create new database migration"
	@echo "  make check          - Run all checks (lint + typecheck + test + security)"

install:
	poetry install

run:
	poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test:
	poetry run pytest

lint:
	poetry run ruff check .

format:
	poetry run ruff format .

typecheck:
	poetry run mypy app

security:
	poetry run bandit -r app

migrate:
	poetry run alembic upgrade head

makemigration:
	poetry run alembic revision --autogenerate

check: lint typecheck test security
	@echo "All checks passed"
