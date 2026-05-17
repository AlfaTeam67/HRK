# 📋 Przegląd Projektu HRK CRM

**Data:** Maj 2026  
**Zespół:** AlfaTeam  
**Status:** Wdrażanie MVP

---

## 🎯 Czym jest HRK CRM?

**HRK CRM** to inteligentny moduł zarządzania relacjami z klientami (CRM) dla **HRK Payroll Consulting**. System wspiera zespół w codziennej obsłudze klientów poprzez:

- 📊 **Centralną kartę klienta** — dane firmy, opiekunowie, historia współpracy
- 📝 **Zarządzanie umowami** — pełny workflow: draft, podpisanie, zmiana statusu
- 💰 **Obsługę waloryzacji** — indeksacja stawek opartą na wskaźnikach (GUS CPI lub stała %)
- 🚨 **Inteligentne alerty** — powiadomienia o zbliżających się terminach umów i waloryzacji
- 📁 **Repozytorium dokumentów** — przesyłanie, OCR, wyszukiwanie wektorowe
- 🤖 **Asystenta AI** — pytania naturalne o dane klienta i dokumenty (RAG)
- 📈 **Raporty KPI** — stan umów, terminy, waloryzacje za wybrane okresy

### Dla kogo?

- **Account Managerowie** — zarządzanie portfelem klientów, monitoring terminów
- **Menadżerowie** — raporty operacyjne, KPI zespołu
- **Kierownictwo** — przegląd stanu umów i przychodu

---

## 🛠️ Stack technologiczny

### Backend

- **Framework:** FastAPI (Python 3.12)
- **Baza danych:** PostgreSQL 17 + pgvector (wyszukiwanie wektorowe) + JSONB (dane elastyczne)
- **ORM:** SQLAlchemy (async)
- **Migracje:** Alembic (automatyczne, oparte o SQLAlchemy)
- **API:** REST + OpenAPI 3.0
- **Autentykacja:** Active Directory (SSO/LDAP — planowany)

### Frontend

- **Framework:** React 19 + TypeScript
- **Build:** Vite
- **State Management:** Redux Toolkit
- **Data Fetching:** TanStack Query (React Query)
- **Styling:** Tailwind CSS v4
- **UI Components:** shadcn/ui (Radix UI)

### Storage

- **S3:** MinIO (self-hosted, S3-compatible)
- **Dokumenty:** Presigned URLs, szyfrowanie SSE, bucket private

### AI

- **LLM:** Gemma 4 (lokalnie na Ollama)
- **Embedding:** nomic-embed-text (768-wymiarowy, lokalnie na Ollama)
- **RAG:** Vector search via pgvector (cosine distance)

### Infrastruktura

- **Konteneryzacja:** Docker + Docker Compose
- **Database Container:** PostgreSQL 17 + pgvector
- **Storage Container:** MinIO + minio-init (bootstrap bucketa)
- **LLM Container:** Ollama (background task processing)

---

## 🏗️ Architektura

```
┌─────────────────────────────────────────────────────┐
│ Frontend (React + Vite)                             │
│  ├─ Dashboard (30/60/90 dni, status)                │
│  ├─ Karta klienta (dane, historia, dokumenty)       │
│  ├─ Umowy (CRUD, status, waloryzacja)               │
│  ├─ Stawki (CustomerRate, waloryzacja miesięczna)   │
│  ├─ Asystent AI (RAG na dokumentach)                │
│  └─ Alerty (powiadomienia push)                     │
└──────────┬────────────────────────────────────────┘
           │ REST API (fetch, axios)
           │
┌──────────▼──────────────────────────────────────────┐
│ Backend API (FastAPI)                               │
│  ├─ /api/v1/customers (CRM)                         │
│  ├─ /api/v1/contracts (umowy)                       │
│  ├─ /api/v1/rates (stawki i waloryzacja)            │
│  ├─ /api/v1/documents (załączniki)                  │
│  ├─ /api/v1/assistant (RAG chat)                    │
│  └─ /api/v1/alerts (alerty)                         │
│                                                      │
│  Warstwy:                                            │
│  ├─ API Router → Validacja + Auth                   │
│  ├─ Service Layer → Logika biznesowa                │
│  ├─ Repository Layer → Data Access (SQLAlchemy)     │
│  └─ Models → Schemat PostgreSQL                     │
└──────────┬────────────────────────────────────────┘
           │
┌──────────┴────────────────────────────────────────┐
│ Persistence & Storage                              │
│  ├─ PostgreSQL 17                                  │
│  │   ├─ customers, contracts, services, rates      │
│  │   ├─ customer_rates, valorizations              │
│  │   ├─ attachments, document_chunks (pgvector)    │
│  │   └─ audit logs, alerts, activity logs          │
│  │                                                  │
│  ├─ MinIO (S3-compatible)                          │
│  │   └─ hrk-documents bucket (private)              │
│  │                                                  │
│  └─ Ollama (LLM backend)                            │
│      ├─ nomic-embed-text (768-dim embeddings)       │
│      └─ Gemma 4 (text generation)                   │
└──────────────────────────────────────────────────────┘
```

### Flowa zapytania (synchroniczne)

```
Żądanie HTTP
    ↓
API Router (deps: get_db dependency injection)
    ↓
Service Layer (business logic, validation)
    ↓
Repository Layer (SQL queries, AsyncSession)
    ↓
SQLAlchemy ORM ↔ PostgreSQL
    ↓
Response (JSON, schemy Pydantic)
```

---

## 📚 Encje (Tabele w bazie danych)

### Tier 1 — Fundament

| Tabela      | Opis                                             | Klucz       | Status  |
| ----------- | ------------------------------------------------ | ----------- | ------- |
| `users`     | Użytkownicy (synced z AD)                        | `id` (UUID) | aktywna |
| `companies` | Podmioty prawne (optatywnie linked do customers) | `id` (UUID) | aktywna |

### Tier 2 — CRM

| Tabela                | Opis                                          | Klucz                          | Status  |
| --------------------- | --------------------------------------------- | ------------------------------ | ------- |
| `customers`           | Klienci (CKK, CKD)                            | `id` (UUID)                    | aktywna |
| `contact_persons`     | Osoby kontaktowe klientów                     | `id` (UUID), FK: `customer_id` | aktywna |
| `contracts`           | Umowy klientów (ramowa, aneks, SLA, DPA, PPK) | `id` (UUID), FK: `customer_id` | aktywna |
| `contract_amendments` | Aneksy do umów                                | `id` (UUID), FK: `contract_id` | aktywna |

### Tier 3 — Usługi i Stawki

| Tabela                 | Opis                                                             | Klucz                                        | Status  |
| ---------------------- | ---------------------------------------------------------------- | -------------------------------------------- | ------- |
| `service_groups`       | Grupy usług (hierarchia)                                         | `id` (UUID)                                  | aktywna |
| `services`             | Definicje usług (jednostka: per_person, ryczałt, per_hour, etc.) | `id` (UUID), FK: `service_group_id`          | aktywna |
| `contract_services`    | Usługi w danej umowie (scope, SLA, volume limit)                 | `id` (UUID), FK: `contract_id`, `service_id` | aktywna |
| `customer_rates`       | Cennik usługi w danym roku                                       | `id` (UUID), FK: `contract_service_id`       | aktywna |
| `customer_rate_months` | Cena netto per miesiąc (normalizacja 12→12 kolumn)               | `id` (UUID), FK: `rate_id`                   | aktywna |

### Tier 4 — Dokumenty i Notatki

| Tabela            | Opis                                        | Klucz                                                       | Status  |
| ----------------- | ------------------------------------------- | ----------------------------------------------------------- | ------- |
| `attachments`     | Pliki (PDF, dokumenty, aneksy) w S3         | `id` (UUID), FK: `customer_id`, `contract_id`, `company_id` | aktywna |
| `document_chunks` | Chunki tekstu dla RAG (embeddingi pgvector) | `id` (UUID), FK: `attachment_id`                            | aktywna |
| `notes`           | Notatki ze spotkań, maili                   | `id` (UUID), FK: `customer_id`, `contract_id`               | aktywna |

### Tier 5 — CRM Activity & Monitoring

| Tabela                     | Opis                                            | Klucz                                         | Status    |
| -------------------------- | ----------------------------------------------- | --------------------------------------------- | --------- |
| `activity_logs`            | Logi aktywności (spotkania, emaile, połączenia) | `id` (UUID), FK: `customer_id`, `contract_id` | immutable |
| `alerts`                   | Alerty dla Account Managerów                    | `id` (UUID), FK: `customer_id`, `contract_id` | aktywna   |
| `customer_relation_scores` | Scoring klienta (AI lub ręczny) — 0..1          | `id` (UUID), FK: `customer_id`                | aktywna   |

### Tier 6 — Waloryzacja

| Tabela          | Opis                                                          | Klucz                                         | Status  |
| --------------- | ------------------------------------------------------------- | --------------------------------------------- | ------- |
| `valorizations` | Indeksacja stawek (roczna, typ: GUS_CPI / fixed_pct / custom) | `id` (UUID), FK: `contract_id`, `approved_by` | aktywna |

### Tier 7 — Audit

| Tabela       | Opis                                               | Klucz       | Status                      |
| ------------ | -------------------------------------------------- | ----------- | --------------------------- |
| `audit_logs` | Logi zmian (CREATE, UPDATE, DELETE, RESTORE, VIEW) | `id` (UUID) | immutable, brak FK cascades |

---

## 🔗 Relacje między encjami

```
users
├── PK: id
└── Relacje:
    ├── 1:N → managed_customers (account_manager_id w customers)
    ├── 1:N → created_by / updated_by (audit mixin)
    └── 1:N → approved_by (approver w valorizations)

companies
├── PK: id
└── 1:N → customers

customers ⭐ (centralna, soft-delete)
├── PK: id (UUID)
├── FK: company_id (nullable)
├── FK: account_manager_id (NOT NULL, RESTRICT)
├── Atrybuty:
│   ├─ ckk, ckd (unikatowe ID klienta)
│   ├─ segment, industry, employee_count
│   ├─ payment_period_days (dni do zapłaty)
│   ├─ billing_nip, invoice_nip, billing_email
│   ├─ address_* (ulica, miasto, kod, kraj)
│   └─ additional_data (JSONB)
└── Relacje:
    ├── 1:1 → company
    ├── 1:1 → account_manager (User)
    ├── 1:N → contact_persons
    ├── 1:N → contracts
    ├── 1:N → notes
    ├── 1:N → attachments
    ├── 1:N → activity_logs
    ├── 1:N → relation_scores
    └── 1:N → alerts

contact_persons ⭐
├── PK: id
├── FK: customer_id (CASCADE)
└── Atrybuty:
    ├─ first_name, last_name
    ├─ email, phone, role
    ├─ is_primary, is_contract_signer
    └─ additional_data (JSONB)

contracts ⭐ (soft-delete, hierarchy parent_id)
├── PK: id
├── FK: customer_id (RESTRICT) ← zależy od klienta
├── FK: account_manager_id (SET NULL)
├── FK: parent_contract_id (self-reference, SET NULL)
├── Atrybuty:
│   ├─ contract_number (unique)
│   ├─ contract_type (ramowa, aneks, SLA, DPA, PPK, inne)
│   ├─ status (draft, signed, active, expiring, terminated)
│   ├─ start_date, end_date
│   ├─ notice_period_days (90), notice_conditions
│   ├─ billing_cycle (monthly, quarterly, annual, one_time)
│   ├─ governing_law (PL)
│   └─ additional_data (JSONB)
└── Relacje:
    ├── 1:N → child_contracts (self)
    ├── 1:N → amendments (ContractAmendment)
    ├── 1:N → contract_services
    ├── 1:N → valorizations
    ├── 1:N → notes
    ├── 1:N → attachments
    ├── 1:N → activity_logs
    └── 1:N → alerts

contract_amendments (aneksy)
├── PK: id
├── FK: contract_id (RESTRICT)
├── FK: document_id → attachments (SET NULL)
└── Atrybuty:
    ├─ amendment_number (unikat per contract)
    ├─ amendment_date, effective_date
    ├─ scope_of_change (opis zmian)
    └─ approved_by_client, approved_by_hrk

service_groups ⭐ (hierarchia)
├── PK: id
├── FK: parent_id (self-reference, nullable)
└── name

services ⭐
├── PK: id
├── FK: service_group_id
├── Atrybuty:
│   ├─ name (nazwa usługi)
│   ├─ billing_unit (per_person, ryczałt, per_hour, per_doc, per_item)
│   ├─ billing_frequency (monthly, quarterly, one_time, on_demand)
│   └─ additional_data
└── 1:N → contract_services

contract_services ⭐ (junction: Contract ↔ Service)
├── PK: id
├── FK: contract_id (RESTRICT)
├── FK: service_id (RESTRICT)
├── Atrybuty:
│   ├─ scope_description
│   ├─ volume_limit, volume_unit
│   ├─ sla_definition
│   ├─ is_billable
│   ├─ valid_from, valid_to (date range)
│   └─ additional_data
└── 1:N → customer_rates

customer_rates ⭐ (ceny per rok)
├── PK: id
├── FK: contract_service_id (RESTRICT)
├── FK: valorization_id (SET NULL) ← linked valorization
├── Atrybuty:
│   ├─ year (int)
│   ├─ base_price (Numeric 10,2)
│   ├─ discount_pct (0..100%)
│   └─ created_by (User)
├── Constraint: UNIQUE (contract_service_id, year)
└── 1:N → customer_rate_months

customer_rate_months ⭐ (normalizacja: 1 wiersz per miesiąc)
├── PK: id
├── FK: rate_id (CASCADE)
├── Atrybuty:
│   ├─ month (1..12, CHECK)
│   └─ net_price (Numeric 10,2) ← cena netto w danym miesiącu
└── Constraint: UNIQUE (rate_id, month)

attachments ⭐ (dokumenty w S3)
├── PK: id
├── FK: customer_id (CASCADE, nullable)
├── FK: contract_id (CASCADE, nullable)
├── FK: company_id (SET NULL, nullable)
├── FK: amendment_id (SET NULL, nullable)
├── FK: uploaded_by (SET NULL, nullable)
├── Atrybuty:
│   ├─ document_type (contract, amendment, power_of_attorney, DPA, PPK, report, other)
│   ├─ original_filename
│   ├─ s3_bucket, s3_key (unique)
│   ├─ mime_type, file_size_bytes
│   ├─ ocr_status (pending, processing, done, failed, skipped)
│   ├─ extracted_text (full text after OCR)
│   ├─ extracted_fields (JSONB, dane z OCR)
│   └─ version (int)
└── 1:N → document_chunks

document_chunks ⭐ (RAG, pgvector)
├── PK: id
├── FK: attachment_id (CASCADE)
├── FK: customer_id (CASCADE, nullable)
├── Atrybuty:
│   ├─ chunk_index (int)
│   ├─ content (Text, tekst chunka)
│   ├─ token_count (int)
│   ├─ page_number (int, nullable)
│   ├─ bbox (JSONB, bounding box dla PDF)
│   ├─ section_title (str)
│   └─ embedding (Vector(768), pgvector) ← nomic-embed-text
└── Index: HNSW (cosine_ops) na embedding

notes ⭐
├── PK: id
├── FK: customer_id (CASCADE, nullable)
├── FK: contract_id (CASCADE, nullable)
├── FK: created_by (SET NULL, nullable)
├── Atrybuty:
│   ├─ note_type (meeting, call, internal, client_request, other)
│   └─ content (Text)
└── Constraint: CHECK (customer_id IS NOT NULL OR contract_id IS NOT NULL)

activity_logs ⭐ (immutable)
├── PK: id
├── FK: customer_id (CASCADE, nullable)
├── FK: contract_id (SET NULL, nullable)
├── FK: performed_by (SET NULL, nullable)
├── Atrybuty:
│   ├─ activity_type (meeting, email, note, document, verification, call, system)
│   ├─ description
│   ├─ activity_date (TIMESTAMP TZ)
│   └─ additional_data (JSONB)
└── ⚠️ NO updated_at, deleted_at, no soft-delete

alerts ⭐
├── PK: id
├── FK: customer_id (CASCADE, nullable)
├── FK: contract_id (CASCADE, nullable)
├── FK: assigned_to (SET NULL, nullable)
├── Atrybuty:
│   ├─ alert_type (contract_expiry, valorization_overdue, no_contact, high_discount, contract_notice, custom)
│   ├─ status (open, acknowledged, resolved, snoozed)
│   ├─ trigger_date (date)
│   ├─ days_before (int, nullable)
│   ├─ message (tekst alertu)
│   └─ acknowledged_at (TIMESTAMP, nullable)
└── Constraint: CHECK (customer_id IS NOT NULL OR contract_id IS NOT NULL)

customer_relation_scores ⭐ (scoring)
├── PK: id
├── FK: customer_id (CASCADE)
├── Atrybuty:
│   ├─ score_date (date)
│   ├─ score_label (good, needs_attention, churn_risk)
│   ├─ score_value (Numeric 3,2, 0.00..1.00, CHECK)
│   ├─ reasoning (text, nullable)
│   └─ calculated_by (ai, manual)
└── Constraint: UNIQUE (customer_id, score_date)

valorizations ⭐⭐⭐ (WALORYZACJA)
├── PK: id
├── FK: contract_id (RESTRICT)
├── FK: approved_by (SET NULL)
├── FK: created_by (SET NULL)
├── Atrybuty:
│   ├─ year (int, rocznik waloryzacji)
│   ├─ index_type (GUS_CPI, fixed_pct, custom)
│   ├─ index_value (Numeric 5,2, %), np. 3.50 dla CPI lub 5.00 dla fixed
│   ├─ planned_date (date, kiedy powinna być zastosowana)
│   ├─ applied_date (date, nullable, kiedy rzeczywiście zastosowana)
│   ├─ status (pending, approved, applied, rejected)
│   ├─ notes (string, komentarz)
│   ├─ created_at, updated_at (timestamps)
│   └─ additional_data (JSONB)
├── Constraint: UNIQUE (contract_id, year)
└── 1:N → customer_rates (FK: valorization_id)

audit_logs ⭐ (immutable, no cascades)
├── PK: id
├── FK: user_id (SET NULL, nullable)
├── Atrybuty:
│   ├─ entity_type (string, np. 'Customer')
│   ├─ entity_id (UUID, referencja do encji)
│   ├─ action (CREATE, UPDATE, DELETE, RESTORE, VIEW)
│   ├─ old_values (JSONB, nullable)
│   ├─ new_values (JSONB, nullable)
│   ├─ ip_address, user_agent
│   └─ created_at
└── ⚠️ NO CASCADE, NO SOFT DELETE
```

---

## 📊 Migracje (Alembic)

Projekt używa **Alembic** do kontroli wersji schematu bazy. Migracje są **automatycznie generowane** z modeli SQLAlchemy za pomocą:

```bash
make makemigration MSG="opis zmian"
```

### Główne migracje (chronologicznie)

| ID             | Opis                                                                                   | Data        | Status |
| -------------- | -------------------------------------------------------------------------------------- | ----------- | ------ |
| `dda74663e6ba` | Inicjalna MVP: wszystkie tabele (Tier 0–7)                                             | 2026-04-22  | ✅     |
| `c3f8e2a1b0d9` | Normalizacja enum values na lowercase                                                  | ~2026-04-23 | ✅     |
| `a1b2c3d4e5f6` | Dodanie indeksu na `contact_persons.email`                                             | ~2026-04-24 | ✅     |
| `40a1f8a0d4a7` | Dodanie `company_id` do `attachments`                                                  | ~2026-04-25 | ✅     |
| `1b2c3d4e5f6a` | Uproszczenie `users` (zmiana z `ad_username` na `login`, usunięcie niepotrzebnych pól) | ~2026-04-26 | ✅     |
| `b9813a3347a3` | Merge multiple heads (jeśli było rozwidlenie gałęzi)                                   | ~2026-04-27 | ✅     |

### Jak działają migracje?

1. **Autogenerate:** `make makemigration MSG="..."` — Alembic porównuje modele SQLAlchemy z bieżącym schematem i generuje `upgrade()` i `downgrade()`.
2. **Apply:** `make migrate` — uruchamia `alembic upgrade head`, czyli wszystkie pending migracje.
3. **Async:** `alembic/env.py` używa `asyncio` + `async_engine_from_config` (PostgreSQL + asyncpg).
4. **Naming:** Konwencja nazw w `base.py` zapewnia deterministyczne nazwy constraintów:
   - ForeignKey: `fk_table_column_reftable`
   - Index: `ix_column`
   - Unique: `uq_table_column`
   - CheckConstraint: `ck_table_constraint`

### Ważne uwagi

- ❌ **Nigdy** nie edytuj ręcznie schematu bazy — zawsze poprzez migracje Alembic.
- ✅ Jeśli zmienisz model SQLAlchemy, uruchom `make makemigration`.
- 🔄 Po migracjach w produkcji, uruchom `npm run types:sync` w frontend, aby zsynchronizować typy API.

---

## 💰 WALORYZACJA — Szczegółowy opis

### Czym jest waloryzacja?

**Waloryzacja** (valorization) to proces **indeksacji/podwyższenia stawek** w umowach na podstawie wskaźnika inflacji lub ustalonego procenta. W systemie HRK waloryzacja:

- dotyczy **umowy** (contract), nie pojedynczej usługi
- następuje **raz w roku** (na zmianę roku kalendarzowego lub daty rocznicowej umowy)
- używa **wskaźnika** (GUS CPI, stały %, lub custom)
- aktualizuje **wszystkie stawki** (customer_rates) związane z tą umową
- ma **status** (pending → approved → applied lub rejected)

### Tabela `valorizations` — struktura

```sql
CREATE TABLE valorizations (
    id UUID PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
    year INTEGER NOT NULL,
    index_type VARCHAR (GUS_CPI | fixed_pct | custom),
    index_value NUMERIC(5,2) NOT NULL,  -- np. 3.50 (3.5%) lub 5.00 (5%)
    planned_date DATE NOT NULL,          -- kiedy powinna być zastosowana
    applied_date DATE,                   -- kiedy rzeczywiście zastosowana (null = nie zastosowana)
    status VARCHAR (pending | approved | applied | rejected),
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    additional_data JSONB,

    UNIQUE (contract_id, year),
    CHECK (index_value > 0 AND index_value <= 100)
);
```

### Relacja z customer_rates

```
Valorization (1)
    ↓
    → N × CustomerRate (FK: valorization_id)
        └─ Każda stawka dla danego roku może mieć linked valorization
```

```python
# Model
class CustomerRate(Base):
    valorization_id: UUID | None  # Link do waloryzacji
    # ... inne pola
    valorization: Valorization | None = relationship("Valorization", back_populates="customer_rates")

class Valorization(Base):
    customer_rates: list[CustomerRate] = relationship("Valorization", back_populates="valorization")
```

### Flow waloryzacji (w czym uczestniczy)

#### 1️⃣ **Tworzenie waloryzacji (Pending)**

```python
POST /api/v1/valorizations
{
    "contract_id": "uuid-123",
    "year": 2025,
    "index_type": "GUS_CPI",
    "index_value": 3.5,          # procent wzrostu
    "planned_date": "2025-01-15", # kiedy powinna wejść w życie
    "notes": "Indeksacja na podstawie GUS CPI za 2024"
}
```

**Wynik:**

- Tworzy się rekord `Valorization` ze statusem `PENDING`
- Powiadomienie/alert dla account managera: „Zbliża się waloryzacja na dzień X"
- Nic nie zmienia się w stawkach (`customer_rates`)

#### 2️⃣ **Zatwierdzenie waloryzacji (Approved)**

```python
PATCH /api/v1/valorizations/{id}
{
    "status": "APPROVED",
    "approved_by": "uuid-approver"
}
```

**Wynik:**

- Status zmienia się na `APPROVED`
- Wciąż nic się nie zmienia w stawkach
- Alert może zostać escalated dla kierownika

#### 3️⃣ **Zastosowanie waloryzacji (Applied) — KLUCZOWY KROK**

```python
PATCH /api/v1/valorizations/{id}
{
    "status": "APPLIED",
    "applied_date": "2025-01-15"
}
```

**Wynik (domyślnie w serwisie, jeśli będzie zaimplementowany):**

- Dla każdego `ContractService` tej umowy (`contract_id`):
  - Pobierz `CustomerRate` dla roku 2025
  - Dla każdego miesiąca w `CustomerRateMonth`:
    - `new_net_price = old_net_price × (1 + index_value / 100)`
    - Zaaktualizuj rekord (lub utwórz nowy dla przejrzystości audytu)
  - Link do `Valorization` (update `valorization_id` w `CustomerRate`)

**Przykład:**

```
Stara cena (styczeń 2025): 1000 PLN
Index: 3.5% (GUS_CPI)
Nowa cena: 1000 × 1.035 = 1035 PLN
```

#### 4️⃣ **Odrzucenie waloryzacji**

```python
PATCH /api/v1/valorizations/{id}
{
    "status": "REJECTED",
    "notes": "Klient nie zgadza się z indeksacją CPI"
}
```

**Wynik:**

- Status = `REJECTED`
- Stawki **nie zmieniają się**
- Alert: „Waloryzacja na rok 2025 została odrzucona"

---

### 🔄 Statusy waloryzacji (`ValorizationStatus`)

| Status       | Opis                                                                                      | Co się dzieje                                                                              | Kto go zmienia             |
| ------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------- |
| **PENDING**  | Waloryzacja właśnie została zaproponowana (utworzona), czeka na zatwierdzenie             | Stawki **nie zmieniają się**, alert dla kierownika                                         | Account Manager (creator)  |
| **APPROVED** | Kierownik lub menadżer zatwierdził wskaźnik i plan indeksacji                             | Stawki **wciąż nie zmieniają się**, czeka na faktyczne stosowanie                          | Kierownik/Menadżer         |
| **APPLIED**  | Waloryzacja została faktycznie **zastosowana** — stawki zostały zaktualizowane w systemie | Stawki **zostają zmienione** (pomnożone przez indeks), generowany link do `customer_rates` | Account Manager (executor) |
| **REJECTED** | Waloryzacja została **odrzucona** (np. klient się nie zgadzał)                            | Stawki **nie zmieniają się**, nie będą stosowane                                           | Kierownik/Menadżer         |

**Dlaczego 4 statusy?**

- **Separacja odpowiedzialności:** Tworzenie ≠ zatwierdzenie ≠ wdrażanie
- **Audit trail:** Pełna historia zmian i decyzji
- **Flexibility:** Zatwierdzenie bez ryzyka — stawki zmienią się dopiero na **APPLIED**
- **Kontrola:** Kto co zrobił i kiedy

### Typy wskaźników (`index_type`)

| Type        | Opis                                                | Przykład | Źródło                 |
| ----------- | --------------------------------------------------- | -------- | ---------------------- |
| `GUS_CPI`   | Wskaźnik cen konsumenta (Główny Urząd Statystyczny) | 3.5      | API GUS lub manual     |
| `FIXED_PCT` | Stały procent ustalony w umowie                     | 5.0      | Umowa (dodatkowe dane) |
| `CUSTOM`    | Niestandardowy (np. wynegocjowany)                  | 2.5      | Custom agreement       |

### Alerty związane z waloryzacją

System generuje alerty:

```python
# Alert: Zbliżająca się waloryzacja (0–30 dni, status = PENDING)
AlertType.VALORIZATION_PENDING
→ "Zbliżająca się waloryzacja na dzień {planned_date}"

# Alert: Zaległa waloryzacja (planned_date < dzisiaj)
AlertType.VALORIZATION_OVERDUE
→ "Waloryzacja zaplanowana na {planned_date} jest opóźniona"
```

---

### Implementacja w kodzie

#### Repository (`repo/valorizations.py`)

```python
class ValorizationRepository:
    async def list(self, contract_id: UUID | None, year: int | None, status: ValorizationStatus) -> list[Valorization]:
        # Filtruj po contract_id, year, status
        ...

    async def create(self, data: dict) -> Valorization:
        # Utwórz nową waloryzację
        ...

    async def update(self, val: Valorization, data: dict) -> Valorization:
        # Aktualizuj waloryzację (status, applied_date, etc.)
        ...
```

#### Service (`service/valorizations.py`)

```python
class ValorizationCrudService:
    async def list_valorizations(self, contract_id: UUID | None, year: int | None, status: ValorizationStatus):
        return await self.valorizations.list(...)

    async def create_valorization(self, payload: ValorizationCreate) -> Valorization:
        # Tworzy rekord ze statusem PENDING
        ...

    async def update_valorization(self, id: UUID, payload: ValorizationUpdate) -> Valorization:
        # Zmienia status (APPROVED → APPLIED)
        # TODO: Logika stosowania cen mogłaby tutaj być
        ...
```

#### API (`api/valorizations.py`)

```python
@router.post("/valorizations", response_model=ValorizationRead)
async def create_valorization(payload: ValorizationCreate, db: AsyncSession = Depends(get_db)):
    service = ValorizationCrudService(ValorizationRepository(db))
    return await service.create_valorization(payload)

@router.patch("/valorizations/{id}", response_model=ValorizationRead)
async def update_valorization(id: UUID, payload: ValorizationUpdate, db: AsyncSession = Depends(get_db)):
    service = ValorizationCrudService(ValorizationRepository(db))
    return await service.update_valorization(id, payload)
```

#### Schema (`schemas/valorizations.py`)

```python
class ValorizationCreate(BaseModel):
    contract_id: UUID
    year: int
    index_type: IndexType  # GUS_CPI | fixed_pct | custom
    index_value: Decimal   # 0.01 .. 99.99
    planned_date: date
    status: ValorizationStatus = ValorizationStatus.PENDING
    notes: str | None = None

class ValorizationRead(ORMBaseSchema):
    id: UUID
    contract_id: UUID
    year: int
    index_type: IndexType
    index_value: Decimal
    planned_date: date
    applied_date: date | None
    status: ValorizationStatus
    approved_by: UUID | None
    created_at: datetime
    updated_at: datetime
```

---

### Scenariusz: Waloryzacja umowy na 2025

```
📅 Bieżąca data: 2024-12-20
📋 Umowa: HR-2024-001 (Customer: Acme Corp)
├── ContractService #1: Doradztwo HR (3 osoby, 2500 PLN/osobę/miesiąc)
└── ContractService #2: Payroll (1200 PLN/miesiąc ryczałt)

1. Grudzień 2024 — Przygotowanie
   - GUS opublikował CPI na 2025: 3.5%

2. 2024-12-21 — Account Manager tworzy waloryzację:
   POST /api/v1/valorizations
   {
       "contract_id": "acme-uuid",
       "year": 2025,
       "index_type": "GUS_CPI",
       "index_value": 3.5,
       "planned_date": "2025-01-01",
       "notes": "CPI 2025 wg GUS"
   }
   → Valorization(id=val-123, status=PENDING)
   → Alert: „Zbliżająca się waloryzacja dla HR-2024-001"

3. 2024-12-28 — Menadżer zatwierdza:
   PATCH /api/v1/valorizations/val-123
   {
       "status": "APPROVED",
       "approved_by": "manager-uuid"
   }
   → Valorization.status = APPROVED

4. 2025-01-02 — Account Manager stosuje waloryzację:
   PATCH /api/v1/valorizations/val-123
   {
       "status": "APPLIED",
       "applied_date": "2025-01-01"
   }
   → Wartości customer_rates przeliczane:
      - Doradztwo HR: 2500 → 2587.50 PLN/osobę/miesiąc
      - Payroll: 1200 → 1242 PLN/miesiąc

5. 2025-01-03 — Alert: ✓ Waloryzacja na 2025 zastosowana
```

---

## 🔄 Enums (Wyliczenia w systemie)

### Statusy i typy

```python
# Użytkownicy
UserRole: ADMIN, ACCOUNT_MANAGER, MANAGER, VIEWER

# Klienci
CustomerStatus: ACTIVE, CHURN_RISK, NEEDS_ATTENTION, INACTIVE

# Umowy
ContractType: RAMOWA, ANEKS, SLA, DPA, PPK, INNE
ContractStatus: DRAFT, SIGNED, ACTIVE, EXPIRING, TERMINATED

# Billing
BillingCycle: MONTHLY, QUARTERLY, ANNUAL, ONE_TIME
BillingUnit: PER_PERSON, RYCZALT, PER_HOUR, PER_DOC, PER_ITEM
BillingFrequency: MONTHLY, QUARTERLY, ONE_TIME, ON_DEMAND

# Dokumenty
DocumentType: CONTRACT, AMENDMENT, POWER_OF_ATTORNEY, DPA, PPK, REPORT, OTHER
OcrStatus: PENDING, PROCESSING, DONE, FAILED, SKIPPED

# Aktywność
ActivityType: MEETING, EMAIL, NOTE, DOCUMENT, VERIFICATION, CALL, SYSTEM
NoteType: MEETING, CALL, INTERNAL, CLIENT_REQUEST, OTHER

# Scoring
ScoreLabel: GOOD, NEEDS_ATTENTION, CHURN_RISK
CalculatedBy: AI, MANUAL

# Alerty
AlertType: CONTRACT_EXPIRY, VALORIZATION_OVERDUE, NO_CONTACT, HIGH_DISCOUNT, CONTRACT_NOTICE, CUSTOM
AlertStatus: OPEN, ACKNOWLEDGED, RESOLVED, SNOOZED

# Waloryzacja ⭐
IndexType: GUS_CPI, FIXED_PCT, CUSTOM
ValorizationStatus: PENDING, APPROVED, APPLIED, REJECTED

# Audit
AuditAction: CREATE, UPDATE, DELETE, RESTORE, VIEW
```

---

## 🎁 Mixiny (wspólne cechy)

```python
CreatedAtMixin       # created_at (auto, immutable)
TimestampMixin       # created_at + updated_at (created_at auto, updated_at on update)
SoftDeleteMixin      # deleted_at (nullable, do soft-delete)
AuditMixin           # created_by, updated_by (FK to users)
```

**Które tabele mają które mixiny?**

| Tabela        | Created | Updated | SoftDelete | Audit |
| ------------- | ------- | ------- | ---------- | ----- |
| customers     | ✓       | ✓       | ✓          | ✓     |
| contacts      | ✓       | ✗       | ✓          | ✗     |
| contracts     | ✓       | ✓       | ✓          | ✓     |
| notes         | ✓       | ✓       | ✓          | ✗     |
| attachments   | ✓       | ✗       | ✓          | ✗     |
| activity_logs | ✓       | ✗       | ✗          | ✗     |
| alerts        | ✓       | ✗       | ✗          | ✗     |
| audit_logs    | ✓       | ✗       | ✗          | ✗     |
| valorizations | ✓       | ✓       | ✗          | ✗     |

---

## 📖 Podsumowanie

| Aspekt          | Co zawiera                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| **Encje**       | 18 tabel + pgvector dla RAG                                                                               |
| **Relacje**     | Hierarchia (contracts, service_groups); junctions (contract_services); soft-delete (customers, contracts) |
| **Migracje**    | 6 wersji schematu (Alembic, async)                                                                        |
| **Waloryzacja** | Indeksacja stawek per umowa, 3 typy wskaźników, workflow PENDING→APPROVED→APPLIED                         |
| **AI**          | pgvector (cosine search), nomic-embed-text (768-dim), Gemma 4 (LLM)                                       |
| **Dokumenty**   | S3/MinIO + OCR + embeddingi dla RAG                                                                       |
| **Audit**       | Immutable logs dla pełnej kontroli zmian                                                                  |

---

## 📚 Pliki do czytania (dokumentacja)

- `docs/rag-design.md` — architektura RAG, flow embedding, Ollama
- `docs/s3-security-design.md` — bezpieczeństwo dokumentów (SSE, presigned URLs)
- `docs/ad-auth-design.md` — integracja Active Directory
- `CLAUDE.md` — guidelines dla Claude (LLM assistant w repo)
- `backend/README.md` — setup lokalny, baza danych, komendy

---

**Koniec przeglądu. Powodzenia przy prezentacji! 🚀**
