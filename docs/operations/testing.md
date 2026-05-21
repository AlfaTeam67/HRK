# Testy i strategia QA

## Cel

Pokazać, **jak działają testy** w HRK CRM i jak je dodawać. W projekcie
mamy testy backendowe (pytest), brak (jeszcze) frontendowych — frontend
jest weryfikowany przez `tsc -b` i ręczne smoke testy.

---

## Stack testowy

### Backend
- **pytest** + **pytest-asyncio** (`asyncio_mode = "auto"`).
- **FastAPI TestClient** (sync) dla większości endpointów.
- **httpx.AsyncClient** dla testów async (rzadko potrzebne).
- **moto** — mock S3.
- **pytest-cov** — pokrycie (opcjonalnie).

Konfiguracja w `pyproject.toml`:
```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "session"
addopts = "--strict-markers -v"
pythonpath = ["src"]
```

### Frontend
- **Brak** dedykowanego frameworka testowego (jeszcze).
- `tsc -b && vite build` jako smoke test integracyjny.
- ESLint + Prettier — statyczna jakość.

> Plan: dodać Vitest + React Testing Library dla kluczowych hooków
> i komponentów (`DocumentWizard`, `AdvisorPage`).

---

## Struktura testów backendowych

```
backend/tests/
├── __init__.py
├── conftest.py                       # fixtures
├── test_health.py                    # smoke /health
├── test_api_v1.py                    # smoke / generic
├── test_crm_api.py                   # CRM endpoints (customers, contracts)
├── test_notes_api.py                 # notes
├── test_alerts_api.py                # alerts endpoint
├── test_alert_service.py             # AlertService unit tests
├── test_activity_log_api.py          # activity log
├── test_documents_integration.py     # upload + processing
├── test_rag_service.py               # RAG search (mock embed)
├── test_timeline_service.py          # customer timeline
└── test_document_generation_accept.py # accept flow (mocked LLM/S3)
```

---

## Uruchamianie

```bash
# Wszystkie testy
make test                          # = pytest

# Pojedynczy plik
poetry run pytest tests/test_health.py -v

# Pojedynczy test
poetry run pytest tests/test_crm_api.py::test_create_customer -v

# Z dockerowymi zależnościami (DB, MinIO, Ollama)
make test-docker
# = docker compose up -d db minio minio-init ad schema-manager ollama
#   PYTHONPATH=src poetry run pytest

# Pokrycie
poetry run pytest --cov=src/app --cov-report=term-missing
```

---

## Konwencje

### Nazewnictwo
- Plik: `test_<co_testujemy>.py`.
- Funkcja: `def test_<co_testuje>(<fixtures>) -> None:`.
- Klasa (gdy potrzebna grupacja): `class TestFooBar:`.

### Markery
```python
import pytest

@pytest.mark.asyncio
async def test_async_thing():
    ...

@pytest.mark.skip(reason="requires real Ollama")
def test_real_embedding():
    ...
```

`asyncio_mode="auto"` oznacza, że **każda** funkcja `async def test_*`
jest automatycznie odpalana w event loopie — nie potrzeba `@asyncio`.

### TestClient
```python
from fastapi.testclient import TestClient
from app.main import app

def test_health(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "environment": "development"}
```

### Przygotowanie DB
W `conftest.py` jest fixture, która:
- tworzy świeżą sesję dla testu,
- uruchamia migracje do head'a (lub `Base.metadata.create_all`),
- po teście rollback / drop.

> Konkretny mechanizm — sprawdź w `tests/conftest.py`. Wzorzec może
> być per-test transakcyjny (rollback) lub pełny reset.

---

## Co testujemy (priorytetowo)

### Smoke (must-have)
- `/health`, `/`.
- Login flow (`POST /auth/login/{username}` + mock AD).
- CRUD każdej encji — happy path tworzenia + odczytu.

### Logika domenowa (high value)
- `AlertService` — okna 30/60/90, `valorization_overdue`, `no_contact`
  (z mocked datami).
- `RAGService` — search z mocked embedderem i rerankerem.
- `simulate_valorization` — różne `index_type`, `discount_pct`,
  `billing_cycle`. Decimal! Brak floatów.
- `DocumentGenerationService.accept` — kolejność operacji
  (commit nowego stanu **przed** cleanupem).
- `DocumentProcessingService` — chunker (granica strony, overlap).

### Integracja (smoke + scenariusz)
- Upload PDF → wpis w `attachments` → background task → `document_chunks`.
- Generate amendment → preview → finalize → accept → indeksacja.
- Logowanie → utworzenie usera → drugi login = ten sam user.

---

## Mockowanie

### S3 (moto)
```python
import boto3
from moto import mock_aws

@mock_aws
def test_upload(monkeypatch):
    boto3.client("s3").create_bucket(Bucket="hrk-documents")
    # teraz każde wywołanie boto3 leci do moto, nie do MinIO
```

### Ollama / OpenRouter
W testach **nie** uderzaj w prawdziwą Ollamę / OpenRouter. Patrz wzorzec:

```python
class FakeEmbeddingService:
    async def embed(self, text: str) -> list[float]:
        return [0.0] * 768
    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [[0.0] * 768 for _ in texts]
```

W teście:
```python
service = RAGService(FakeEmbeddingService(), FakeLLMService(), FakeRerankerClient())
```

### Reranker
Mock podobnie jak LLM. Reranker w runtime ma fallback (gdy padnie),
więc test bez kontenera FlashRank też działa.

### AD
Mikroserwis ma `AD_MOCK_MODE=true`. Testy logowania mogą uderzać w
prawdziwy mock-mode AD service (przy `make test-docker`) lub mockować
`ADLoginService._fetch_ad_user`.

---

## CI (TODO / plan)

Aktualnie repo nie ma pipeline'u CI. Plan minimum:

1. **GitHub Actions** workflow (`.github/workflows/ci.yml`):
   - `make check` (lint + mypy + test + bandit).
   - `cd frontend && npm ci && npm run lint && npm run build`.
2. **Pre-commit** hook:
   - `ruff format` + `ruff check --fix` przed commitem.
   - Block na `.env` z `S3_SECRET_KEY` ≠ `minioadmin` /
     `OPENROUTER_API_KEY ≠ ""`.

---

## Code coverage — gdzie być powyżej 80%

| Moduł | Coverage cel |
|---|---|
| `app/service/alert.py` | ≥ 90% (logika progów krytyczna) |
| `app/service/document_generation/simulator.py` | ≥ 95% (kalkulacje finansowe) |
| `app/service/rag.py` | ≥ 80% |
| `app/service/document.py` | ≥ 80% (upload + cleanup) |
| `app/repo/*` | ≥ 70% (proste CRUD) |
| `app/api/*` | ≥ 60% (smoke) |

---

## Antywzorce

- ❌ Test dotyka prawdziwego internetu / OpenRouter / Ollamy → flaky.
- ❌ Test zostawia śmieci w DB / S3 — używaj `tmp_path` lub fixture
  z teardownem.
- ❌ Asserty po `==` na floatach — używaj `Decimal` i `pytest.approx`
  na floatach.
- ❌ `time.sleep` w teście — fixture `freezegun` lub `monkeypatch.setattr(
  ..., 'datetime.now', ...)`.
- ❌ Logika DB w teście (np. tworzenie kompleksowego stanu manualnie) —
  wynieś do fixture / factory (`pytest-factoryboy` jeśli kiedyś).

---

## Manualne smoke testy (przed PR-em)

Lista, którą warto przeklikać:

1. **Login** — wpisz `asia` w LoginPage → redirect na dashboard.
2. **Klient** — utwórz nowego klienta → otwórz → dodaj kontakt → notatkę.
3. **Umowa** — utwórz umowę → podepnij usługę → upload PDF → poczekaj
   aż badge OCR zmieni się na ✅.
4. **Asystent AI** — pytaj o klienta. Switch trybu AI ON → odpowiedź
   tekstowa.
5. **Generowanie** — wygeneruj aneks waloryzacyjny → preview → finalize
   → accept. Sprawdź że PDF (czysty, bez DRAFT) ląduje w zakładce
   „Dokumenty".
6. **Alerty** — `ManagerDashboardPage` → lista alertów per opiekun.

---

## Dalej

- [`runbook.md`](runbook.md) — jak postawić środowisko.
- [`troubleshooting.md`](troubleshooting.md) — gdy testy padają.
- [`../conventions/agents-guidelines.md`](../conventions/agents-guidelines.md)
  — checklist dodawania feature'u (z testami).
