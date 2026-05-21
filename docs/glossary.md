# Glosariusz

## Cel

Krótkie definicje pojęć **biznesowych** (HRK Payroll) i **technicznych**
(stack), które padają w kodzie, dokumentacji, prompcie LLM-a.
Jeśli czegoś nie rozumiesz — zacznij tutaj.

---

## A

**Account manager** — opiekun konta. Pracownik HRK przypisany do
klienta. W modelu: `Customer.account_manager_id → User`. Niektóre
endpointy filtrują widoczność per `account_manager_id` (self-filter).

**Aktywność (ActivityLog)** — niezmienialny dziennik działań CRM
(spotkanie, mail, notatka, dokument, weryfikacja). Tabela
`activity_logs`. Brak `updated_at`, brak `deleted_at` — append-only.

**Aneks (Amendment / `ContractAmendment`)** — zmiana parametrów umowy
bez tworzenia nowej. Encja `contract_amendments`. Może mieć
przypięty PDF (`document_id → attachments`).

**Alert** — wirtualne powiadomienie operacyjne („umowa wygasa za 30
dni", „waloryzacja po terminie"). W MVP **liczone on-the-fly** przez
`AlertService`, nie persystowane.

**Alembic** — narzędzie migracyjne dla SQLAlchemy. Migracje w
`backend/alembic/versions/`.

**Active Directory (AD)** — firmowy katalog tożsamości. HRK CRM
synchronizuje użytkowników z AD przez mikroserwis `services/ad/`.
W MVP — tryb mock (`AD_MOCK_MODE=true`).

**`additional_data`** — kolumna JSONB w wielu tabelach. Pole „luźnych"
metadanych, których nie chcemy reprezentować jako kolumny. Default:
`'{}'::jsonb`, `nullable=False`.

---

## B

**`BackgroundTask`** — mechanizm FastAPI do uruchamiania zadania
**po wysłaniu odpowiedzi HTTP**. Używamy do chunkingu / OCR / embeddingu
po uploadzie. Brak retry — MVP tradeoff.

**Bbox** — bounding box (`{x0, y0, x1, y1}`). Współrzędne fragmentu w
PDF. Trzymane w `document_chunks.bbox` (JSONB). Używane do podświetlania
na froncie.

**Billing cycle** — częstotliwość rozliczania umowy: `monthly`,
`quarterly`, `annual`, `one_time`. Wpływa na kalkulację waloryzacji
(`periods_per_year`).

**Bandit** — narzędzie do skanowania bezpieczeństwa kodu Python.
`make security`.

---

## C

**CKK / CKD** — wewnętrzne identyfikatory klienta HRK (płaska księga).
Pola w `customers.ckk` (UNIQUE) i `customers.ckd` (UNIQUE NULLABLE).

**Chunk** — fragment tekstu dokumentu (~400 tokenów ≈ 1600 znaków).
Encja `document_chunks` z embedding'iem 768-dim.

**Cosine distance** — miara podobieństwa wektorów (`<=>` w pgvector).
0 = identyczne, 1 = ortogonalne, 2 = przeciwne. Mniejsze = bardziej
podobne.

**Cover letter** — pismo przewodnie do aneksu waloryzacyjnego.
Generowane przez LLM (`LLMService.generate_cover_letter`).

**Cron / harmonogram** — w MVP **brak**. Alerty są liczone on-the-fly,
nie persystowane.

---

## D

**DocumentGeneration** — encja reprezentująca jedną generację AI
(aneks + cover letter). Trzyma snapshot `payload`, `simulation`,
`ai_artifacts`, status (`draft → preview → accepted`).

**Document chunk** — patrz Chunk.

**`document_type`** — enum klasyfikujący załączniki: `contract`,
`amendment`, `power_of_attorney`, `DPA`, `PPK`, `report`, `cover_letter`,
`other`.

**DRAFT watermark** — półprzezroczysty napis „DRAFT" na PDF aneksu w
fazie `preview`. Znika po `accept`.

---

## E

**Embedding** — wektor liczbowy reprezentujący znaczenie tekstu. HRK
używa `nomic-embed-text` (Ollama), 768 floatów. Tabela
`document_chunks.embedding`.

**Enum (StrEnum)** — Python `enum.StrEnum`. Wartości serializują się
jako stringi. W DB zapisywane jako VARCHAR (`native_enum=False`).

---

## F

**FastAPI** — framework webowy Python. Backend HRK CRM.

**FlashRank** — biblioteka do reranking'u dokumentów. Mikroserwis
`services/reranker/` (port 8003).

---

## G

**Gemma** — rodzina modeli LLM od Google. HRK używa `google/gemma-4-31b-it:free`
(domyślnie, przez OpenRouter) lub lokalnego `gemma3:4b` na Ollamie.

**GUS_CPI** — wskaźnik cen towarów i usług konsumpcyjnych z Głównego
Urzędu Statystycznego. Domyślny `IndexType` waloryzacji.

---

## H

**HNSW** — Hierarchical Navigable Small World. Algorytm KNN dla
wektorów. W HRK indeks `idx_chunks_embedding_hnsw` (m=16,
ef_construction=64).

**HRK** — firma payroll consulting. Klient projektu (i nazwa systemu).

---

## I

**Index value (waloryzacja)** — procent podwyżki (np. 4.50). Pole
`Valorization.index_value` (Numeric(5,2)).

---

## J

**Jinja2** — engine szablonów. Używany w `app/templates/documents/` do
renderowania HTML aneksów/pism, które potem WeasyPrint zamienia na PDF.

**JSONB** — typ danych PostgreSQL dla danych JSON. Indeksowalny (GIN).
W HRK używany w `additional_data`, `audit_logs`, `document_generations`.

---

## K

**Kerberos** — protokół autoryzacji. Plan post-MVP dla SSO.

**KPI** — Key Performance Indicators. Endpoint
`GET /api/v1/dashboard/kpi` zwraca podstawowe agregaty (active customers,
expiring contracts, ...).

---

## L

**LLM** — Large Language Model. W HRK: Gemma 4 przez OpenRouter (lub
lokalnie przez Ollamę).

**LDAP** — protokół katalogowy. Sposób komunikacji z AD (planowany w
mikroserwisie `services/ad/`).

---

## M

**MinIO** — open-source S3-compatible object storage. Lokalny zamiennik
AWS S3.

**Mixin (SQLAlchemy)** — `TimestampMixin`, `SoftDeleteMixin`,
`AuditMixin`, `CreatedAtMixin`. Współdzielone kolumny dla wielu modeli.

**mypy** — type checker Python. `make typecheck`.

---

## N

**`nomic-embed-text`** — model embeddingu z Nomic AI. 768-dim. Działa
przez Ollamę.

**Notice period** — okres wypowiedzenia umowy. Pole
`Contract.notice_period_days` (default 90).

---

## O

**Ollama** — lokalny runtime LLM-ów (HTTP API na :11434). HRK używa do
embeddingów (zawsze) i opcjonalnie do LLM (zamiast OpenRouter).

**OpenAPI** — specyfikacja API generowana przez FastAPI. Dostępna na
`/api/v1/openapi.json` w trybie debug. Frontend regeneruje typy z niej
przez `npm run types:sync`.

**OpenRouter** — pośrednik / agregator API LLM-ów (https://openrouter.ai).
Domyślny dostawca LLM dla HRK.

**`ocr_status`** — status indeksowania attachment'u: `pending`,
`processing`, `done`, `failed`, `skipped`. Sterowany przez
`DocumentProcessingService`.

---

## P

**pgvector** — rozszerzenie PostgreSQL do wektorów. Typ `Vector(N)`,
operatory `<=>`, `<->`, `<#>`.

**Presigned URL** — tymczasowy podpisany URL do obiektu w S3/MinIO.
W HRK: TTL 5 min (`DOCUMENT_PRESIGNED_URL_TTL_SECONDS`).

**Primary document** — flagowy PDF umowy
(`Contract.primary_document_id`).

**Pydantic** — biblioteka do walidacji typów Python. Wersja v2 w HRK.
Używana do schematów request/response (`app/schemas/`).

---

## Q

**Query (TanStack Query)** — hook na frontendzie do server state.
`useQuery`, `useMutation`, `queryKey`, cache.

---

## R

**RAG (Retrieval-Augmented Generation)** — paradygmat: zamiast pytać
LLM "z głowy", najpierw wyciągamy relevantne fragmenty z bazy
wektorowej, potem dajemy LLM-owi te fragmenty + pytanie. HRK używa do
Asystenta AI.

**Reranker** — komponent, który po vector search ponownie sortuje
wyniki bardziej dokładnym (ale wolniejszym) modelem. HRK: FlashRank
mikroserwis.

**Repository pattern** — warstwa data access. `app/repo/`. Jeden plik
= jedno repo (`CustomerRepository`, `ContractsRepo`, ...).

**Ruff** — linter + formatter Python. `make lint`, `make format`.

---

## S

**Schemat (Pydantic schema)** — kontrakt request/response. Każda
encja ma `Create`, `Update`, `Read`. W `app/schemas/`.

**Section title** — tytuł sekcji w dokumencie. Pole
`document_chunks.section_title` — kontekst dla LLM (puste w MVP).

**Service (warstwa)** — logika biznesowa. `app/service/`. Może wołać
inne serwisy i repozytoria.

**Service (encja `Service`)** — billable usługa HRK (Payroll, PPK, …).
Encja `services`. Pivot do `Contract` przez `ContractService`.

**ServiceGroup** — hierarchia grup usług (drzewo z materialized path).
Encja `service_groups`.

**Soft delete** — usuwanie przez ustawienie `deleted_at`, nie `DELETE`.
W zapytaniach **zawsze** filtruj po `deleted_at IS NULL`.

**SPNEGO** — protokół negocjacji autoryzacji (Kerberos w przeglądarce).
Plan post-MVP.

**SSE (Server-Sent Events)** — strumień zdarzeń HTTP (`text/event-stream`).
Używamy do AI summary streaming.

**SSE (Server-Side Encryption)** — szyfrowanie obiektów S3 po stronie
serwera. HRK: AES256 (SSE-S3).

---

## T

**TanStack Query** — biblioteka do server state na froncie
(@tanstack/react-query).

**Timeline** — oś czasowa zdarzeń per klient. Endpoint
`GET /customers/{id}/timeline`. Składa notatki + aktywności +
dokumenty.

---

## U

**UUID** — Universally Unique Identifier. Wszystkie PK w HRK.

**uvicorn** — ASGI server dla FastAPI.

---

## V

**Valorization (waloryzacja)** — roczna indeksacja stawek umowy.
Encja `valorizations`. Statusy: `pending`, `approved`, `applied`,
`rejected`. UNIQUE `(contract_id, year)`.

**`Vector(768)`** — typ pgvector. 768 wymiarów wymuszone przez model
embeddingu.

---

## W

**Watermark (DRAFT)** — patrz DRAFT.

**WeasyPrint** — Python library do renderowania HTML → PDF.
Backend serwisu `DocumentGenerationService`.

**WebSocket** — protokół duplex. HRK: `/api/v1/alerts/ws/{client_id}`
(push alertów).

---

## X / Y / Z

**`X-Accel-Buffering: no`** — nagłówek wysyłany przy SSE — wyłącza
buforowanie po stronie reverse proxy (Nginx).

---

## Skróty

| Skrót | Rozwinięcie |
|---|---|
| AD     | Active Directory |
| API    | Application Programming Interface |
| BE     | Backend |
| BFF    | Backend For Frontend (nie używamy) |
| CRM    | Customer Relationship Management |
| CRUD   | Create / Read / Update / Delete |
| CKK    | Centralna Księga Klienta (HRK-specific) |
| CKD    | Centralna Księga Dostawcy (HRK-specific) |
| DI     | Dependency Injection |
| DPA    | Data Processing Agreement |
| DPI    | Dots Per Inch (rendering PDF) |
| ERD    | Entity Relationship Diagram |
| FE     | Frontend |
| FK     | Foreign Key |
| GUS    | Główny Urząd Statystyczny |
| HNSW   | Hierarchical Navigable Small World |
| KPI    | Key Performance Indicator |
| LDAP   | Lightweight Directory Access Protocol |
| LLM    | Large Language Model |
| MIME   | Multipurpose Internet Mail Extensions |
| MVP    | Minimum Viable Product |
| OCR    | Optical Character Recognition |
| OIDC   | OpenID Connect |
| ORM    | Object-Relational Mapping |
| PDF    | Portable Document Format |
| PII    | Personally Identifiable Information |
| PK     | Primary Key |
| PPK    | Pracownicze Plany Kapitałowe |
| RAG    | Retrieval-Augmented Generation |
| SLA    | Service Level Agreement |
| SPA    | Single Page Application |
| SSE    | Server-Sent Events / Server-Side Encryption (kontekstowo!) |
| SSO    | Single Sign-On |
| TLS    | Transport Layer Security |
| TTL    | Time To Live |
| UI     | User Interface |
| UX     | User Experience |
| VAT    | Podatek od towarów i usług |
| WS     | WebSocket |
