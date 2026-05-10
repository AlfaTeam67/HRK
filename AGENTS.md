# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HRK CRM is a CRM module for HRK Payroll Consulting (ZZPJ 2025/2026 semester project by AlfaTeam). It supports client management, contract/valorization workflows, deadline alerts, KPI reports, and an AI assistant for document-based Q&A.

## Repository Structure

```
HRK/
├── backend/    # FastAPI Python application
└── frontend/   # React + TypeScript + Vite application
```

---

## Backend (FastAPI + Python 3.12)

### Commands (run from `backend/`)

```bash
# Local dev
make install        # Install dependencies via Poetry
make run            # Run dev server at localhost:8000 (uvicorn --reload)
make test           # Run pytest
make lint           # Ruff linter
make format         # Ruff formatter
make typecheck      # mypy
make security       # bandit security scan
make check          # lint + typecheck + test + security (all at once)
make migrate        # Apply alembic migrations (alembic upgrade head)
make makemigration  # Generate new migration (alembic revision --autogenerate)

# Docker (full stack)
make docker-up      # Start API + DB (pgvector) + MinIO
make docker-down    # Stop all containers
make docker-build   # Rebuild images
make docker-logs    # Tail API container logs
make docker-migrate # Run alembic migrations inside running api container
make minio-init     # Manually re-create default S3 bucket
```

### Architecture

- `src/app/main.py` — FastAPI app with lifespan, health/root endpoints. API docs only exposed in debug mode at `/docs` and `/redoc`.
- `src/app/config.py` — Pydantic Settings v2. Reads from `.env`. Key vars: `DATABASE_URL`, `DEBUG`, `FE_DOMAIN`, `API_V1_STR` (`/api/v1`), S3 vars (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`).
- `src/app/core/database.py` — Async SQLAlchemy engine + session factory. Use `get_db()` as FastAPI dependency for `AsyncSession`.
- `src/app/api/` — Route handlers.
- `src/app/models/` — SQLAlchemy ORM models.
- `src/app/schemas/` — Pydantic schemas for request/response validation.
- `src/app/service/` — Business logic layer.
- `src/app/repo/` — Repository pattern: data access abstraction over SQLAlchemy.
- `src/app/utils/` — Shared utilities.
- `alembic/` — DB migration scripts. `alembic.ini` points `script_location = alembic`. Uses async engine (`asyncio.run` + `async_engine_from_config`).
- **src layout**: all application code lives under `src/`. `PYTHONPATH=src` (set in Dockerfile as `/app/src`, in pytest via `pythonpath = ["src"]`, in make targets explicitly). This avoids import collisions between the `alembic/` migrations folder and the installed `alembic` package.

### Layered Request Flow

`API router → Service → Repository → SQLAlchemy (AsyncSession)`

All DB access must go through the repository layer; services must not import SQLAlchemy directly.

### Testing

Tests live in `backend/tests/`. Run a single test file: `poetry run pytest tests/test_health.py -v`. Use `TestClient` from FastAPI for sync tests; `pytest-asyncio` for async tests (`asyncio_mode = "auto"`).

---

## Frontend (React 19 + TypeScript + Vite)

### Commands (run from `frontend/`)

```bash
npm run dev          # Dev server (Vite)
npm run build        # Type-check + production build
npm run lint         # ESLint
npm run format       # Prettier (writes)
npm run format:check # Prettier (check only)
npm run types:sync   # Regenerate API types from backend OpenAPI spec (backend must be running on :8000)
```

### Architecture

- `src/main.tsx` — Entry point; mounts React app with Redux `<Provider>` and React Router `<BrowserRouter>`.
- `src/App.tsx` — Root routes. All pages are nested inside `<AppLayout>`. Routes: `/` (Dashboard), `/clients`, `/contracts`, `/valorization`, `/assistant`, `/access`, `/reports`.
- `src/pages/` — Page-level components, one per route.
- `src/features/` — Feature slices. Currently has `auth/`.
- `src/store/` — Redux Toolkit store. Slices in `store/slices/` (e.g., `authSlice.ts`).
- `src/components/layout/AppLayout.tsx` — Shell wrapping all authenticated pages.
- `src/components/ui/` — shadcn/ui component library components.
- `src/types/` — TypeScript types. `src/types/api.ts` is **auto-generated** by `npm run types:sync` — do not edit manually.
- `src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge).
- `@/` alias resolves to `src/`.

### State & Data Fetching

- **Server state:** TanStack Query (`@tanstack/react-query`).
- **Client/UI state:** Redux Toolkit (`@reduxjs/toolkit` + `react-redux`).
- **HTTP client:** axios.

### Styling

Tailwind CSS v4 (via `@tailwindcss/vite` plugin). Component variants via `class-variance-authority`. UI components from shadcn/ui (Radix UI primitives). Icon set: `@hugeicons/react`.

---

## Key Decisions & Context

- **No user registration** — authentication is via Active Directory (SSO/LDAP). Auth state is managed in Redux (`authSlice`).
- **AI assistant** — RAG-based using phi-3.5 on Ollama (local LLM). Page: `/assistant` → `AdvisorPage`.
- **Database** — PostgreSQL 17 with pgvector extension (`pgvector/pgvector:pg17` image). The `DATABASE_URL` uses the `postgresql+asyncpg://` driver; alembic runs async migrations via `asyncio.run()` + `async_engine_from_config`.
- **Storage** — MinIO (S3-compatible) runs on port 9000, console on 9001. Default bucket `hrk-documents` is auto-created by the `minio-init` container on `docker compose up`. The `minio-init` service uses `minio/mc` image.
- **JSONB** — PostgreSQL `additional_data` JSONB columns used for flexible fields. pgvector used for embeddings (AI assistant).
- **API types** — Always run `npm run types:sync` after changing backend schemas to keep the frontend types in sync.
- **Migrations** — Always generate a new migration after changing any SQLAlchemy model; never hand-edit the DB schema directly.
