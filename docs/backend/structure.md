# Backend — struktura kodu

## Cel

Wyjaśnić, **gdzie co leży** i dlaczego. Dokument ratuje czas każdemu, kto
chce dorzucić nowy endpoint, encję albo serwis.

---

## Drzewo katalogów (skrót)

```
backend/
├── alembic/
│   ├── env.py                  # async migration runner
│   ├── script.py.mako          # template migracji
│   └── versions/               # historie migracji
├── alembic.ini                 # konfiguracja alembica (script_location=alembic)
├── docker-compose.yml          # db + minio + minio-init + api + ollama
│                               # + ollama-init + ad + schema-manager + reranker
├── Dockerfile                  # python:3.12-slim + poetry install + run uvicorn
├── Makefile                    # make install/run/test/migrate/up/...
├── postman/                    # kolekcje do testów manualnych
├── pyproject.toml              # zależności (poetry) + ruff + mypy + pytest
├── services/
│   ├── ad/                     # mikroserwis AD (port 8001)
│   ├── reranker/               # mikroserwis reranker (port 8003)
│   └── schema_manager/         # narzędzie introspekcyjne (port 8002)
├── src/
│   └── app/                    # CAŁY KOD APLIKACJI
│       ├── main.py             # FastAPI app + CORS + lifespan
│       ├── config.py           # Pydantic Settings (ENV)
│       ├── core/               # database session, websockets, storage DI, exceptions
│       ├── api/                # routery FastAPI (per moduł)
│       │   ├── v1/             # nowy router (/api/v1/customers, /documents, /rag, ...)
│       │   └── *.py            # CRM legacy router (contracts, notes, services, ...)
│       ├── service/            # logika biznesowa (CRMService, AlertService, ...)
│       ├── repo/               # data access (jeden moduł = jedno repo)
│       ├── models/             # SQLAlchemy ORM (jeden plik = jedna grupa modeli)
│       ├── schemas/            # Pydantic v2 (request/response)
│       ├── templates/          # Jinja2 (templates/documents/{key}/manifest.yml + .html)
│       ├── utils/              # s3_client itp.
│       └── scripts/            # seed_demo, jednorazówki
└── tests/                      # pytest + pytest-asyncio
```

> **Ważne:** `PYTHONPATH=src`. Dlatego importy są `from app.config import settings`,
> a nie `from src.app.config import settings`. `src/`-layout jest świadomy —
> chroni przed kolizją z folderem `alembic/` i pakietem `alembic` (PyPI).

---

## Warstwy (w skrócie)

| Warstwa | Lokalizacja | Co tam jest                              |
|---------|-------------|------------------------------------------|
| Routing | `src/app/api/`, `src/app/api/v1/` | Endpointy FastAPI, walidacja typu requestu, mapowanie wyjątków → HTTP. |
| Logika  | `src/app/service/`                | Reguły domenowe, orkiestracja, integracja z AI/AD/Storage. |
| Dane    | `src/app/repo/`                   | Zapytania SQLAlchemy. Brak logiki domenowej. |
| Modele  | `src/app/models/`                 | ORM (SQLAlchemy 2 declarative). |
| Schematy| `src/app/schemas/`                | Pydantic v2 — kontrakty IO. |
| Core    | `src/app/core/`                   | Database session, exceptions, websockets, DI dla storage. |

Reguła kierunku zależności:

```
api  →  service  →  repo  →  ORM/AsyncSession
schemas ←──┴────────┴── (używane przez api i service do serializacji)
models ←─────────────── (używane przez repo i service do reprezentacji)
```

Service **może** wołać inny Service (kompozycja, np.
`DocumentGenerationService` używa `LLMService`, `StorageService`,
`DocumentProcessingService`).

---

## `main.py`

```python
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    openapi_url=f"{settings.api_v1_str}/openapi.json" if settings.debug else None,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware, allow_origins=[settings.fe_domain], ...)

app.include_router(v1_router, prefix=settings.api_v1_str)   # /api/v1/...
app.include_router(crm_router, prefix=settings.api_v1_str)  # /api/v1/... (legacy)
```

- W trybie **production** (`DEBUG=false`) nie eksportujemy `/docs`, `/redoc`,
  ani `openapi.json`.
- `lifespan` weryfikuje, że bucket S3 jest prywatny — to się dzieje **raz**,
  przy starcie procesu.

---

## `config.py` — Pydantic Settings

Wszystkie zmienne środowiskowe są scentralizowane w klasie `Settings`. Sekcje:

```python
class Settings(BaseSettings):
    # Application
    app_name, app_version, debug, api_v1_str

    # Database
    database_url: str        # asyncpg DSN, wymagany

    # Server / CORS
    host, port, fe_domain, allowed_hosts

    # AD integration
    ad_service_url, api_ad_domain, ad_request_timeout

    # S3 / MinIO
    s3_endpoint, s3_external_endpoint, s3_bucket
    s3_access_key, s3_secret_key, s3_region
    s3_sse_enabled, s3_sse_algorithm
    s3_require_private_bucket
    document_max_file_size_bytes
    document_presigned_url_ttl_seconds

    # Ollama
    ollama_url, ollama_embed_model

    # Reranker
    reranker_url

    # RAG tuning
    rag_vec_max_distance: float = 0.35

    # OpenRouter
    openrouter_api_key, openrouter_base_url, openrouter_model
```

Plik `.env.example` jest synchronizowany z tymi polami — jeśli dodajesz
zmienną, dodaj ją tam też i zaktualizuj `docs/backend/configuration.md`.

---

## `core/database.py`

```python
engine = create_async_engine(str(settings.database_url), echo=settings.debug)
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
```

- `expire_on_commit=False` — po commitcie ORM-objects zachowują wartości
  (nie ma niespodziewanych „lazy load → session closed").
- Wszędzie wstrzykujesz przez `Depends(get_db)`.
- BackgroundTasks i serwisy spoza request-scope tworzą własną sesję
  przez `async with AsyncSessionLocal()`.

---

## `core/exceptions.py`

Domena dokumentów ma własną hierarchię wyjątków:

- `DocumentError` (baza)
- `DocumentValidationError` → 400
- `DocumentAccessDeniedError` → 403
- `DocumentNotFoundError` → 404
- `DocumentStorageError` → 502 (problem z MinIO)

Routery w `api/v1/documents.py` mapują je na `HTTPException(...)`.
Wzorzec jest godny naśladowania w innych modułach — własne wyjątki >
gołe `HTTPException` w serwisie.

---

## `models/`

Każdy plik = jedna lub kilka powiązanych encji:

| Plik                | Modele                                          |
|---------------------|-------------------------------------------------|
| `base.py`           | `Base`, `TimestampMixin`, `SoftDeleteMixin`, `AuditMixin` |
| `enums.py`          | wszystkie enumy domenowe (`UserRole`, `ContractStatus`, ...) |
| `user.py`           | `User`                                          |
| `company.py`        | `Company`                                       |
| `customer.py`       | `Customer`, `ContactPerson`                     |
| `contract.py`       | `Contract`, `ContractAmendment`                 |
| `service_group.py`  | `ServiceGroup` (hierarchia, materialized path)  |
| `service.py`        | `Service`                                       |
| `contract_service.py` | `ContractService` (pivot Contract ↔ Service) |
| `rate.py`           | `CustomerRate`, `CustomerRateMonth`, `Valorization` |
| `note.py`           | `Note`                                          |
| `attachment.py`     | `Attachment`                                    |
| `document_chunk.py` | `DocumentChunk` (pgvector 768)                  |
| `document_generation.py` | `DocumentGeneration`                       |
| `activity.py`       | `ActivityLog`                                   |
| `score.py`          | `CustomerRelationScore`                         |
| `alert.py`          | `Alert`                                         |
| `audit.py`          | `AuditLog`                                      |
| `__init__.py`       | **Wszystkie** modele są tu re-eksportowane — to MUSI być, żeby `Base.metadata` widziała pełen schemat (autogenerate w Alembicu). |

> Po dodaniu nowego modelu **dodaj import w `models/__init__.py`** —
> inaczej Alembic go nie zauważy.

---

## `schemas/`

Konwencja:

```
schemas/<encja>.py
    <Encja>Base       # wspólne pola (np. `name`, `email`)
    <Encja>Create     # body POST (bez id, bez timestampów)
    <Encja>Update     # body PATCH (wszystkie pola Optional)
    <Encja>Read       # response (z id, timestampami, computed fields)
```

Konfiguracja Pydantic v2 (`from_attributes=True`) pozwala mapować ORM-objects:

```python
class CustomerRead(CustomerBase):
    id: UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
```

---

## `repo/`

Każde repozytorium dziedziczy po `BaseRepository[ModelT]` z `repo/base.py`,
który dostarcza:

- `get(id) -> Model | None`
- `get_multi(skip, limit) -> list[Model]`
- `count() -> int`
- `create(data: dict) -> Model`
- `update(obj, data: dict) -> Model`
- `delete(id, soft=True) -> bool` — `soft=True` ustawia `deleted_at`,
  `soft=False` usuwa fizycznie.

Specyficzne metody (np. `list_excluding_status`, `search` w repo chunków,
`get_by_login` dla `User`) dopisuje się w konkretnym repo.

> Repo NIE robi `commit()`. To odpowiedzialność serwisu lub endpointu.

---

## `service/`

Główny entry-point dla CRM: **`CRMService`** — facade, który łączy wiele
mniejszych serwisów (`customers.py`, `contracts.py`, `notes.py`,
`valorizations.py`, `customer_rates.py`, `service_groups.py`, `services.py`,
`contact_persons.py`, `timeline.py`, `contract_services.py`).

Mniejsze, dedykowane serwisy (poza facadem):
- `alert.py` — wylicza alerty na żądanie (no cron).
- `ai_summary.py` — generacja AI summary klienta + cache 1h + SSE stream.
- `rag.py` — orkiestracja embed → search → rerank → optional LLM.
- `embedding.py` — klient Ollamy.
- `llm.py` — klient OpenRouter (lub lokalnej Ollamy w trybie `/v1`).
- `reranker_client.py` — klient mikroserwisu rerankera.
- `document.py` — upload/list/get/delete dokumentów + presigned URL.
- `document_processing.py` — chunking + embedding + zapis do `document_chunks`.
- `document_generation/` (paczka) — `service.py`, `templates.py`,
  `simulator.py`, `pdf.py`.
- `storage.py` — abstrakcja MinIO (`StorageService`).
- `ad_login.py` — login użytkownika z AD do tabeli `users`.

---

## `api/` vs `api/v1/`

Dlaczego dwa katalogi? Historyczne. Część endpointów (CRM legacy) żyje
w `api/`, nowsze moduły (auth, documents, dashboard, alerts, RAG, document
generation, users, companies, customers AI summary) — w `api/v1/`.

**Oba routery są dokloszone z prefixem `/api/v1`**, więc dla klienta to
jeden spójny URL. W kodzie różnią się tylko strukturą pakietu.

```python
# main.py
app.include_router(v1_router, prefix=settings.api_v1_str)
app.include_router(crm_router, prefix=settings.api_v1_str)
```

> Przy nowych endpointach ⇒ dodawaj do `api/v1/` (chyba że uzupełniasz
> istniejący moduł CRM legacy).

---

## Mikroserwisy w `services/`

Niezależne aplikacje uruchamiane z `docker-compose`:

- `services/ad/` — FastAPI symulator AD (mock + LDAP-ready). Endpoint
  `GET /ad/user?identity=DOMAIN\login` zwraca dane użytkownika.
- `services/reranker/` — FastAPI + FlashRank. Endpoint `POST /api/rerank`.
- `services/schema_manager/` — narzędzie introspekcyjne dla DB.

Każdy ma własny `Dockerfile`, własny `requirements.txt` lub `pyproject.toml`,
własny `.env`.

---

## Konwencje dodatkowe

- **Identyfikatory**: zawsze `UUID(as_uuid=True)`. Brak `Integer` PK.
- **Daty**: `Date` dla kalendarzowych (start/end), `TIMESTAMP(timezone=True)`
  dla audytowych. Domyślny `server_default=text("now()")`.
- **Pieniądze**: `Numeric(10, 2)` (lub `Numeric(5, 2)` dla procentów).
  W kodzie używamy `Decimal`, nigdy `float`.
- **JSON / JSONB**: `JSONB` z `server_default=text("'{}'::jsonb")` —
  pole zawsze niepuste.
- **Soft delete**: `SoftDeleteMixin` ⇒ kolumna `deleted_at TIMESTAMPTZ NULL`.
  W zapytaniach **zawsze** dodaj `WHERE deleted_at IS NULL`.
- **Audyt**: `AuditMixin` daje `created_by`, `updated_by`. Tam, gdzie ma
  sens, wpis trafia też do tabeli `audit_logs` (`AuditLog`).

---

## Dalej

- [`api-reference.md`](api-reference.md) — pełny katalog endpointów.
- [`services.md`](services.md) — co robi który serwis.
- [`../data-model/overview.md`](../data-model/overview.md) — model danych.
