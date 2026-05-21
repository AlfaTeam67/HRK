# Architektura systemu — przegląd

## Cel

Przedstawić HRK CRM **z lotu ptaka**: jakie komponenty są w grze, jak ze sobą gadają,
gdzie kończą się odpowiedzialności jednego, a zaczynają drugiego. Dokument służy jako
mapa dla programistów i agentów AI wchodzących w projekt.

---

## Diagram wysokopoziomowy

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              PRZEGLĄDARKA                                │
│  React 19 + TS + Vite + Redux Toolkit + TanStack Query + axios           │
│  (port 5173 dev / 4173 preview)                                          │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ HTTP (REST + WebSocket /ws/{client_id})
                                │ JSON, Bearer token w nagłówku
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                  FastAPI — HRK Backend (port 8000)                       │
│  src/app/main.py  →  /api/v1/* + CRM legacy router (no prefix /api/v1)   │
│                                                                          │
│  API router  →  Service (logika)  →  Repo (data access)  →  AsyncSession │
└────────┬───────────────────┬──────────────┬──────────────┬───────────────┘
         │                   │              │              │
         ▼                   ▼              ▼              ▼
┌─────────────────┐  ┌────────────────┐  ┌────────┐  ┌─────────────────┐
│ PostgreSQL 17   │  │  MinIO (S3)    │  │ Ollama │  │ AD service      │
│ + pgvector      │  │  bucket:       │  │ :11434 │  │ (mikroserwis,   │
│ (port 5432)     │  │  hrk-documents │  │        │  │  port 8001)     │
│ - relacyjne     │  │  port 9000/    │  │ embed  │  └─────────────────┘
│ - JSONB         │  │  9001 (UI)     │  │ +LLM   │  ┌─────────────────┐
│ - vector(768)   │  │                │  │        │  │ Reranker        │
│ - HNSW index    │  │                │  │        │  │ FlashRank       │
└─────────────────┘  └────────────────┘  └────────┘  │ (port 8003)     │
                                                     └─────────────────┘
                                                     ┌─────────────────┐
                                                     │ OpenRouter API  │
                                                     │ (Gemma 4)       │
                                                     │ external HTTPS  │
                                                     └─────────────────┘
```

---

## Komponenty i odpowiedzialności

### 1. Frontend (`frontend/`)
- React SPA. Layout: `<AppLayout>` z lewym sidebarem (`AppSidebar`) i `<Outlet>`.
- Routing w `src/App.tsx`: `/login`, `/`, `/managed-dashboard`, `/clients`, `/contracts`,
  `/valorization`, `/assistant`, `/access`, `/reports`. Wszystkie strony za wyjątkiem
  loginu są chronione przez `<RequireAuth>`.
- Stan serwerowy: TanStack Query (per encja w `src/hooks/*.ts`).
- Stan klienta: Redux Toolkit (`authSlice` — user + token, persistowane w `localStorage`
  pod kluczem `hrk-auth`).
- HTTP: jeden `axios` instance (`src/lib/axios.ts`) z interceptorem dorzucającym
  `Authorization: Bearer …` i wylogowującym przy 401/403.

### 2. Backend (`backend/`)
- **FastAPI** + Pydantic v2 + SQLAlchemy 2 (async) + Alembic.
- Wpis: `src/app/main.py`. Lifespan startowy weryfikuje, że bucket S3 jest prywatny
  (`storage_service.ensure_bucket_private()`).
- Dwa routery: `app.api.v1.api_router` (nowsze, modułowe — `/api/v1/customers`,
  `/api/v1/documents`, `/api/v1/rag`, …) oraz `app.api.api_router` (starsze CRM
  endpointy: `/api/v1/contracts`, `/api/v1/notes`, `/api/v1/services`, …).
  Oba doklejone z prefixem `/api/v1`.
- Layout `src/`: `api/`, `service/`, `repo/`, `models/`, `schemas/`, `core/`, `utils/`,
  `templates/`, `scripts/`. Migracje: `backend/alembic/versions/`.

### 3. Baza danych
- PostgreSQL 17 z rozszerzeniami `pgvector` (image `pgvector/pgvector:pg17`).
- Wszystkie modele dziedziczą z `app.models.base.Base`. Mixiny: `TimestampMixin`,
  `CreatedAtMixin`, `SoftDeleteMixin`, `AuditMixin`.
- Konwencja nazewnicza ograniczeń (zob. `models/base.py`) ⇒ deterministyczne nazwy
  w autogenerowanych migracjach.
- Klucze: zawsze `UUID(as_uuid=True)` (`uuid.uuid4`), nigdy autoincrement.
- Enumy zapisywane jako `VARCHAR` (`native_enum=False`) — unikamy bolesnego
  `ALTER TYPE … ADD VALUE` przy migracjach.

### 4. Storage (MinIO)
- Bucket `hrk-documents` tworzony automatycznie przez serwis `minio-init`
  (image `minio/mc`, uruchamiany raz przy starcie compose).
- Konwencja kluczy: `companies/{company_id}/{document_id}_{filename}` lub
  `customers/{customer_id}/...` (per `DocumentService._build_object_key`).
- Bezpieczeństwo: SSE-S3 (`AES256`), private bucket, presigned URL TTL 300 s.
- Strumień bajtów do FE: dwa tryby — `/documents/{id}/download-url` (presigned)
  lub `/documents/{id}/stream` (proxy przez backend).

### 5. AI / RAG
- **Embeddingi**: `EmbeddingService` → Ollama `nomic-embed-text`, wektor 768.
- **LLM**: `LLMService` → OpenRouter (`google/gemma-4-31b-it:free` domyślnie).
  Można podmienić na lokalną Ollamę przez zmianę `OPENROUTER_BASE_URL`
  na `http://ollama:11434/v1`.
- **Reranker**: osobny kontener `services/reranker` (FlashRank, port 8003).
  Wywołanie `RerankerClient.rerank()` jest **opcjonalne** — przy niedostępności
  serwisu fallback do sortu po score wektorowym.
- **Generowanie dokumentów**: `DocumentGenerationService` orkiestruje
  Jinja2 (`TemplateRegistry`), kalkulację (`simulate_valorization`), LLM
  (cover letter + rationale), WeasyPrint (`PdfRenderer`), oraz upload do S3.

### 6. AD (mikroserwis)
- Osobny kontener (`services/ad`, port 8001), własny `Dockerfile` i `.env`.
- Tryb `AD_MOCK_MODE=true` — symulowana tożsamość (dev). Tryb produkcyjny
  → LDAP/Kerberos.
- Backend HRK woła `GET http://ad:8001/ad/user?identity=HRK\jkowalski`.
- Mapowanie: AD identity → tabela `users` (`login`, `email`).
  Logika: `app.service.ad_login.ADLoginService`.

### 7. Reranker (mikroserwis)
- `services/reranker` — FastAPI + FlashRank.
- Endpoint `POST /api/rerank` przyjmuje `{query, documents}`, zwraca listę
  ze scorami przesortowanymi malejąco.

### 8. Schema-manager (mikroserwis pomocniczy)
- `services/schema_manager`, port 8002. Narzędzie do introspekcji / utility,
  nie jest częścią głównego flow CRM.

---

## Granice zaufania

```
INTERNET / Korzystający
   │ HTTPS (w docelowej infrastrukturze)
   ▼
[reverse proxy / SPNEGO]   ← w docelowym wdrożeniu (zob. docs/auth/active-directory.md)
   │
   ▼
[FastAPI]                   ← jedyny komponent „wystawiony"
   │
   ├── PostgreSQL           ← TYLKO przez backend
   ├── MinIO                ← TYLKO przez backend (presigned URL po stronie BE)
   ├── Ollama / Reranker    ← TYLKO przez backend
   └── AD service           ← TYLKO przez backend
```

**Nigdy** nie ufamy danym, które przyszły bezpośrednio z frontendu jako
„tożsamość użytkownika". Frontend dostaje token / sesję, a tożsamość
weryfikuje serwer (proxy + AD).

---

## Dlaczego taki podział?

| Decyzja | Powód |
|---|---|
| `src/`-layout w backendzie | Unikamy kolizji `alembic/` (folder migracji) z `alembic` (pakiet PyPI). |
| Async SQLAlchemy + asyncpg | Lepsza skalowalność I/O dla endpointów wykonujących zapytania + HTTP do AI. |
| pgvector zamiast osobnej DB wektorowej | Mniej infry, te same transakcje, prosty pre-filter `customer_id`. |
| JSONB `additional_data` | Pola elastyczne (np. metadane integracyjne) bez ciągłych migracji. |
| Reranker jako osobny mikroserwis | Modele rerankera są heavy w pamięci → izolacja procesu, możliwość skalowania. |
| LLM przez OpenRouter | Brak GPU lokalnie — łatwe demo. Lokalna Ollama jako alternatywa pluggable. |
| Brak rejestracji userów | Domena: payroll consulting. Tożsamości pochodzą z firmowego AD. |
| TanStack Query + Redux | Server-state vs client-state — jedno odpowiada za cache, drugie za UI/auth. |
| openapi-typescript | Single source of truth = OpenAPI z FastAPI. Typy FE są generowane. |

---

## Co NIE jest częścią systemu (świadomie)

- Brak własnej bramki autoryzacyjnej / brak JWT issuera — w MVP polegamy na AD.
- Brak Celery / RabbitMQ — chunking / OCR działają na `BackgroundTasks` FastAPI.
- Brak frontendowego cache wektorowego — wyszukiwanie zawsze idzie do backendu.
- Brak realnego payment providera — to system CRM, nie billingowy.
- Brak harmonogramu cron — alerty są **wyliczane on-the-fly** w `AlertService`,
  nie ma oddzielnego workera.

---

## Kolejne kroki

- Bardziej szczegółowy przepływ żądania: [`request-flow.md`](request-flow.md).
- Strukturę kodu backendu: [`../backend/structure.md`](../backend/structure.md).
- Model danych: [`../data-model/overview.md`](../data-model/overview.md).
