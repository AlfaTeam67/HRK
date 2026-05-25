# Runbook deweloperski

## Cel

„Co kliknąć / wpisać, żeby projekt **działał lokalnie**" — od świeżego
clone'a do uruchomionego frontu i backendu, z migrowanym DB i działającym
RAG.

---

## Wymagania wstępne

- **Docker + docker compose** (najprostszy wariant — całość przez
  compose).
- Albo lokalnie:
  - **Python 3.12** + Poetry,
  - **Node 20+** + npm,
  - **PostgreSQL 17** z rozszerzeniem `pgvector`,
  - **MinIO** (lub kompatybilny S3),
  - **Ollama** (dla embeddingów; LLM może iść przez OpenRouter).

System operacyjny: **macOS / Linux**. Windows: WSL2 zalecane (WeasyPrint
wymaga libów C, wsparcie poza WSL bywa trudne).

---

## Wariant A — Docker compose (rekomendowany)

```bash
git clone <repo> && cd HRK

# 1. Backend env
cp backend/.env.example backend/.env
# Edytuj backend/.env:
#   - POSTGRES_PASSWORD: zmień ze CHANGEME
#   - DATABASE_URL: postgresql+asyncpg://hrk:<your_pwd>@db:5432/hrk_db
#   - OPENROUTER_API_KEY: jeśli chcesz tryb AI w RAG (możesz zostawić puste)
#   - DEBUG: true (lokalnie)

# 2. AD service env
cp backend/services/ad/.env.example backend/services/ad/.env
# Domyślnie AD_MOCK_MODE=true (symulowana tożsamość)

# 3. Start stacku
cd backend
make up
# = docker compose up -d --build
```

Co startuje:
| Serwis           | Port  | Konsola           |
|------------------|-------|-------------------|
| `db` (Postgres)  | 5432  | —                 |
| `minio`          | 9000  | http://localhost:9001 (web) |
| `minio-init`     | —     | (jednorazowo)     |
| `api` (FastAPI)  | 8000  | http://localhost:8000/docs (gdy DEBUG=true) |
| `ollama`         | 11434 | (HTTP API)        |
| `ollama-init`    | —     | (pulluje `nomic-embed-text`) |
| `ad`             | 8001  | http://localhost:8001/docs |
| `schema-manager` | 8002  | (introspekcja)    |
| `reranker`       | 8003  | http://localhost:8003/health |

```bash
# 4. Migracje DB
make docker-migrate
# = docker compose exec api alembic upgrade head

# 5. (opcjonalnie) Seed demo
make docker-seed
# = docker compose exec api python -m app.scripts.seed_demo
```

Sprawdź:
- http://localhost:8000/health → `{"status":"ok"}`.
- http://localhost:8000/docs → Swagger UI.
- http://localhost:9001 → konsola MinIO (`minioadmin` / `minioadmin`).

### Frontend

```bash
cd ../frontend
cp .env.example .env
# Domyślne wartości pasują do backendu na :8000

npm install
npm run dev
# → http://localhost:5173
```

Pierwszy login: użytkownik z mock AD (`asia` w domyślnym configu) →
zostanie utworzony w `users` przy pierwszym `POST /auth/login/asia`.

---

## Wariant B — lokalnie (Poetry + Postgres + MinIO)

```bash
# 1. Postgres + pgvector + MinIO — możesz puścić tylko te kontenery:
cd backend
docker compose up -d db minio minio-init ollama ollama-init

# 2. Backend lokalnie
make install                # poetry install
# Edytuj backend/.env tak, żeby DATABASE_URL używał host=localhost
# np. postgresql+asyncpg://hrk:<pwd>@localhost:5432/hrk_db
make migrate                # alembic upgrade head
make run                    # uvicorn z --reload na :8000

# 3. Frontend lokalnie
cd ../frontend
npm install
npm run dev
```

> Dlaczego nie wszystko lokalnie? Postgres z pgvector i MinIO są łatwiej
> w Dockerze. Backend lokalnie pozwala na hot reload + debugowanie z IDE.

---

## Codzienne komendy (Makefile backend)

```bash
make help            # lista wszystkich celów
make run             # uvicorn z reload
make test            # pytest
make test-docker     # podnosi compose i odpala pytest
make lint            # ruff
make format          # ruff format
make typecheck       # mypy
make security        # bandit
make check           # lint + typecheck + test + security

make migrate         # alembic upgrade head
make makemigration MSG="add foo column"
                     # alembic revision --autogenerate -m "..."

make up              # docker compose up -d --build
make docker-up       # docker compose up -d (bez rebuild)
make docker-down     # docker compose down
make docker-build    # docker compose build
make docker-logs     # logs -f api
make docker-logs-ad  # logs -f ad
make docker-migrate  # alembic upgrade head w kontenerze api
make docker-seed     # seed_demo w kontenerze
make minio-init      # ręczne utworzenie bucketu
```

## Codzienne komendy (frontend)

```bash
npm run dev            # vite dev server (5173)
npm run build          # tsc + vite build → dist/
npm run preview        # serwowanie /dist (4173)
npm run lint           # eslint
npm run format         # prettier --write
npm run format:check   # prettier --check
npm run types:sync     # regen src/types/api.ts (backend musi być na :8000)
```

---

## Cykl developerski (typowy)

### Dodanie endpointu / encji

1. Edytuj model w `backend/src/app/models/*.py`.
2. Dorzuć import w `backend/src/app/models/__init__.py`.
3. Dorzuć schemat Pydantic w `backend/src/app/schemas/*.py`.
4. Dorzuć repo w `backend/src/app/repo/*.py`.
5. Dorzuć logikę w `backend/src/app/service/*.py`.
6. Dorzuć router w `backend/src/app/api/v1/*.py` (lub `api/`).
7. Doklej router w `api/v1/__init__.py` (lub `api/__init__.py`).
8. Wygeneruj migrację:
   ```bash
   make makemigration MSG="add foo column"
   ```
9. **Otwórz** wygenerowaną migrację, sprawdź diff.
10. `make migrate`.
11. `make check` — lint + typecheck + test + security.
12. Frontend: `cd ../frontend && npm run types:sync`.
13. Dodaj hook w `src/hooks/<encja>.ts`, użyj w komponencie.

### Zmiana schematu Pydantic
1. Edytuj `backend/src/app/schemas/*.py`.
2. (Jeśli zmienia się ORM) → migracja.
3. Backend musi być uruchomiony.
4. `cd frontend && npm run types:sync`.

---

## Reset DB (lokalnie)

```bash
docker compose down -v
docker compose up -d db minio minio-init
make docker-migrate
make docker-seed
```

`-v` usuwa wolumeny — **wszystkie dane idą w niebyt**. Używaj świadomie.

---

## Logi i diagnostyka

```bash
# Backend
make docker-logs         # API
make docker-logs-ad      # AD service

# Konkretne kontenery
docker compose logs -f db
docker compose logs -f minio
docker compose logs -f ollama

# Wejście do kontenera
docker compose exec api bash
docker compose exec db psql -U hrk -d hrk_db
```

### Sprawdzenie modeli Ollamy
```bash
docker compose exec ollama ollama list
# nomic-embed-text:latest
# (oraz dowolny gemma model jeśli pulled)
```

### Sprawdzenie bucketu MinIO
```bash
docker compose run --rm minio-init mc ls local/hrk-documents
```

---

## OpenRouter (opcjonalnie)

Tryb AI w RAG i AI summary wymaga klucza:
1. Załóż konto na https://openrouter.ai/keys.
2. Wklej klucz do `backend/.env`:
   ```env
   OPENROUTER_API_KEY=sk-or-v1-...
   OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
   OPENROUTER_MODEL=google/gemma-4-31b-it:free
   ```
3. Restart backendu (`docker compose restart api` lub `make run`).

Bez klucza: `ai_mode=true` zwraca komunikat o rate-limit / błędzie.
Pure retrieval (`ai_mode=false`) działa nadal.

---

## Najczęstsze problemy

| Symptom | Co zrobić |
|---|---|
| `connect ECONNREFUSED ... 5432` | DB nie wstał lub `DATABASE_URL` nie wskazuje na `db` (compose) / `localhost`. |
| `404 /api/v1/openapi.json` | `DEBUG=false` w `.env`. Ustaw `true`. |
| `npm run types:sync` zwisa | Backend nie działa na `:8000`. `make run` lub `make docker-up`. |
| `relation "customers" does not exist` | Brak migracji. `make migrate` (lub `docker-migrate`). |
| RAG nie zwraca chunków | `ocr_status` przy attachmencie? Sprawdź w `psql`: `SELECT id, ocr_status FROM attachments WHERE customer_id='...';`. |
| Asystent AI mówi „rate limit" | OpenRouter 429 — odczekaj minutę albo przełącz na lokalną Ollamę (zob. [`../ai/llm-providers.md`](../ai/llm-providers.md)). |
| `weasyprint: Cannot load library 'pango'` | Brak pakietów systemowych. Na macOS: `brew install pango cairo gdk-pixbuf libffi`. W Dockerze: już są w `Dockerfile`. |
| `pytesseract: tesseract is not installed` | macOS: `brew install tesseract tesseract-lang`. W Dockerze: w obrazie. |

Zob. też [`troubleshooting.md`](troubleshooting.md) (gdy doda się rozszerzony spis).

---

## Test smoke po setupie

```bash
# 1. Health
curl http://localhost:8000/health
# → {"status":"ok","environment":"development"}

# 2. Login (mock AD)
curl -X POST http://localhost:8000/api/v1/auth/login/asia
# → { "id": "...", "login": "asia", "email": "asia@hrk.eu" }

# 3. Lista klientów (po seed)
curl http://localhost:8000/api/v1/customers

# 4. Frontend
open http://localhost:5173
```

---

## Dalej

- [`testing.md`](testing.md) — strategia testów i jak je odpalać.
- [`troubleshooting.md`](troubleshooting.md) — szczegółowe problemy.
- [`../conventions/agents-guidelines.md`](../conventions/agents-guidelines.md) —
  jak pracować nad kodem (dla agentów / nowych devów).
