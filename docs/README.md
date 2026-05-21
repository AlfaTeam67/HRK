# 📚 HRK CRM — Dokumentacja techniczna

Kompletna dokumentacja projektu **HRK CRM** (AlfaTeam · ZZPJ 2025/2026).
Materiał jest punktem wejścia dla nowych programistów oraz agentów AI
pracujących nad kodem. Zawiera architekturę, model danych, opis API,
warstwy frontendu, integracje (AI/RAG, AD, MinIO), runbook deweloperski
oraz konwencje pracy.

> Pliki w katalogu głównym projektu (`README.md`, `AGENTS.md`,
> `.github/copilot-instructions.md`) są punktem startu — ten katalog
> dokumentuje **głębsze szczegóły implementacyjne**.

---

## 🗺️ Mapa dokumentacji

### 1. Architektura systemu
- [`architecture/overview.md`](architecture/overview.md) — diagram, komponenty, technologie, granice odpowiedzialności
- [`architecture/request-flow.md`](architecture/request-flow.md) — przepływ żądania (FE → API → Service → Repo → DB) + przykład

### 2. Backend (FastAPI · Python 3.12)
- [`backend/structure.md`](backend/structure.md) — układ folderów, warstwy, konwencje
- [`backend/api-reference.md`](backend/api-reference.md) — pełny katalog endpointów (per moduł)
- [`backend/services.md`](backend/services.md) — opis serwisów aplikacyjnych (CRMService facade, AlertService, RAGService, …)
- [`backend/repositories.md`](backend/repositories.md) — repozytoria, wzorzec, transakcje
- [`backend/configuration.md`](backend/configuration.md) — zmienne `.env`, `Settings`, dependency injection

### 3. Model danych (PostgreSQL + pgvector + JSONB)
- [`data-model/overview.md`](data-model/overview.md) — diagram ERD + przegląd tabel
- [`data-model/entities.md`](data-model/entities.md) — szczegółowy opis każdej encji (kolumny, indeksy, FK, JSONB)
- [`data-model/enums.md`](data-model/enums.md) — wszystkie enumy domenowe
- [`data-model/migrations.md`](data-model/migrations.md) — Alembic, tworzenie i stosowanie migracji
- [`data-model/jsonb-and-pgvector.md`](data-model/jsonb-and-pgvector.md) — kiedy JSONB, kiedy pgvector, indeksy HNSW

### 4. Frontend (React 19 · TypeScript · Vite)
- [`frontend/overview.md`](frontend/overview.md) — struktura, routing, layout, alias `@/`
- [`frontend/state-and-data.md`](frontend/state-and-data.md) — Redux Toolkit + TanStack Query + axios
- [`frontend/pages-and-features.md`](frontend/pages-and-features.md) — opisy stron i kluczowych feature'ów
- [`frontend/api-types-sync.md`](frontend/api-types-sync.md) — generowanie `src/types/api.ts` z OpenAPI

### 5. AI / RAG / Generowanie dokumentów
- [`ai/rag.md`](ai/rag.md) — embeddingi, chunkowanie, vector search, reranker
- [`ai/document-generation.md`](ai/document-generation.md) — preview → finalize → accept, szablony Jinja2, WeasyPrint
- [`ai/ai-summary.md`](ai/ai-summary.md) — streaming AI summary klienta (SSE), cache 1h
- [`ai/llm-providers.md`](ai/llm-providers.md) — OpenRouter (Gemma) ↔ Ollama (lokalny LLM), prompty

### 6. Autoryzacja i bezpieczeństwo
- [`auth/active-directory.md`](auth/active-directory.md) — login przez AD, mikroserwis `services/ad`, model `User`
- [`auth/permissions.md`](auth/permissions.md) — role, perspektywy widoku, ograniczenia per opiekun
- [`storage/minio.md`](storage/minio.md) — private bucket, SSE, presigned URL, klucze S3

### 7. Workflow operacyjny
- [`workflows/alerts.md`](workflows/alerts.md) — reguły alertów (90/60/30 dni, brak kontaktu, waloryzacja)
- [`workflows/valorization.md`](workflows/valorization.md) — pełny cykl waloryzacji (plan → akceptacja → aplikacja)
- [`workflows/contracts.md`](workflows/contracts.md) — umowy, aneksy, primary document
- [`workflows/document-upload.md`](workflows/document-upload.md) — upload + OCR + chunking
- [`workflows/document-generation.md`](workflows/document-generation.md) — generowanie aneksów/pism z AI

### 8. Operacje (DevOps / Dev)
- [`operations/runbook.md`](operations/runbook.md) — uruchamianie lokalne i Docker (krok po kroku)
- [`operations/testing.md`](operations/testing.md) — strategia testów, struktura `tests/`, pytest
- [`operations/quality.md`](operations/quality.md) — lint, typecheck, security scan
- [`operations/troubleshooting.md`](operations/troubleshooting.md) — typowe problemy + rozwiązania

### 9. Konwencje pracy
- [`conventions/coding-style.md`](conventions/coding-style.md) — Ruff, mypy strict, naming
- [`conventions/agents-guidelines.md`](conventions/agents-guidelines.md) — wytyczne dla agentów AI
- [`conventions/git-workflow.md`](conventions/git-workflow.md) — branche, commity, PR
- [`glossary.md`](glossary.md) — słownik pojęć biznesowych i technicznych

---

## 🚀 Skrót — co zrobić jako pierwsze

1. Przeczytaj [`architecture/overview.md`](architecture/overview.md) — ogólny obraz systemu (10 min).
2. Postaw środowisko zgodnie z [`operations/runbook.md`](operations/runbook.md).
3. Zajrzyj do [`backend/structure.md`](backend/structure.md) i [`frontend/overview.md`](frontend/overview.md).
4. Gdy szukasz konkretnego endpointu → [`backend/api-reference.md`](backend/api-reference.md).
5. Gdy nie wiesz, co znaczy „CKK", „waloryzacja" albo „rerank" → [`glossary.md`](glossary.md).

---

## 🧱 Najważniejsze założenia (TL;DR)

- **Backend**: FastAPI + SQLAlchemy 2 (async) + Alembic. Warstwy `API → Service → Repo → DB`.
  Cały kod aplikacji żyje w `backend/src/app/` (src-layout, `PYTHONPATH=src`).
- **Frontend**: React 19 + TypeScript + Vite + Redux Toolkit + TanStack Query + Tailwind v4 + shadcn/ui.
  Typy API są **autogenerowane** ze schematu OpenAPI (`npm run types:sync`).
- **DB**: PostgreSQL 17 + pgvector + JSONB (`additional_data`). Wektory 768-dim, indeks HNSW.
- **Storage**: MinIO (S3-compatible), private bucket `hrk-documents`, SSE AES256, presigned URL TTL 5 min.
- **AI**: Embeddingi `nomic-embed-text` na lokalnej Ollamie. LLM domyślnie OpenRouter (Gemma),
  możliwy swap na lokalną Ollamę. Reranker = osobny mikroserwis (FlashRank, port 8003).
- **Auth**: brak rejestracji, użytkownicy synchronizowani z Active Directory przez mikroserwis `services/ad`.
- **Migracje**: zawsze przez Alembic — nigdy ręcznie po DB.
- **Typy FE/BE**: po zmianie schematu Pydantic uruchom `npm run types:sync` na frontendzie.

---

## 🧭 Konwencja dokumentacji

- Pliki są w **języku polskim** (zgodnie z domeną biznesową), z technicznymi
  fragmentami kodu po angielsku (zgodnie z kodem).
- Każdy dokument zaczyna się sekcją **Cel** — po co tu jesteś.
- Diagramy ASCII / Mermaid > screenshoty.
- Linki do plików w repo: ścieżki względne od korzenia projektu.
- Aktualizuj dokument przy zmianie kodu, do którego się odnosi.

> Brak dokumentu = brakująca odpowiedzialność. Lepiej napisać krótki stub
> niż zostawić obszar bez dokumentacji.
