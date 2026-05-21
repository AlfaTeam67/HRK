# Model danych — przegląd

## Cel

Pokazać encje HRK CRM, ich relacje i logiczne grupy. Pełne opisy
kolumn znajdziesz w [`entities.md`](entities.md), enumów w
[`enums.md`](enums.md), kwestie JSONB/pgvector w
[`jsonb-and-pgvector.md`](jsonb-and-pgvector.md).

---

## Tieryzacja

Encje są pogrupowane „tierami" — kolejność, w której pojawiały się w schemie
i porządek importów (zob. `app/models/__init__.py`):

| Tier | Domena                  | Encje |
|------|-------------------------|-------|
| 1    | Core / podmioty         | `User`, `Company`, `Customer`, `ContactPerson` |
| 2    | Umowy                   | `Contract`, `ContractAmendment` |
| 3    | Usługi i stawki         | `ServiceGroup`, `Service`, `ContractService`, `CustomerRate`, `CustomerRateMonth`, `Valorization` |
| 4    | Dokumenty i notatki     | `Note`, `Attachment`, `DocumentChunk`, `DocumentGeneration` |
| 5    | Aktywność CRM           | `ActivityLog`, `CustomerRelationScore`, `Alert` |
| 6    | Audyt                   | `AuditLog` |

---

## Diagram ERD (skrót)

```
                                                ┌────────────┐
                                                │  Company   │
                                                └──────┬─────┘
                                                       │ 1:N
                  ┌──────────┐                  ┌──────▼──────┐         ┌──────────────┐
                  │   User   │◄───manager_id────│  Customer   │◄────────│ ContactPerson │
                  └────┬─────┘                  └──────┬──────┘ 1:N      └───────────────┘
                       │ 1:N (uploaded_by, ...)         │ 1:N
                       │                                │
                       │                          ┌─────▼─────┐         ┌────────────────────┐
                       │                          │  Contract │─────────│ ContractAmendment  │
                       │                          └──┬──────┬─┘  1:N    └────────────────────┘
                       │                             │      │                       ▲
                       │                             │      │ 1:N                   │ document_id
                       │                       1:N   │      │                       │
                       │                             ▼      ▼                       │
                       │                  ┌──────────────┐  ┌──────────────┐        │
                       │                  │  Valorization│  │ ContractServ.│◄───┐   │
                       │                  └──────┬───────┘  └──────┬───────┘    │   │
                       │                         │ 1:N             │ 1:N        │   │
                       │                         ▼                 ▼            │   │
                       │                  ┌──────────────┐  ┌──────────────┐    │   │
                       │                  │ CustomerRate │◄─│ CustomerRate │    │   │
                       │                  └───────┬──────┘  └──────────────┘    │   │
                       │                          │                              │   │
                       │                          │ 1:N (12 miesięcy)            │   │
                       │                          ▼                              │   │
                       │                  ┌──────────────────┐                   │   │
                       │                  │CustomerRateMonth │                   │   │
                       │                  └──────────────────┘                   │   │
                       │                                                         │   │
                       │                                              ┌──────────┴───┴┐
                       │                                              │   Service     │
                       │                                              └───────┬───────┘
                       │                                                      │ N:1
                       │                                                      ▼
                       │                                             ┌────────────────┐
                       │                                             │  ServiceGroup  │
                       │                                             └────────────────┘
                       │
                       │  N:1 author / uploader (różne kolumny w różnych tabelach)
                       ▼
       ┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌────────────────┐
       │   Note   │    │Attachment│    │ ActivityLog  │    │CustomerRelation│
       └─────┬────┘    └────┬─────┘    └──────────────┘    │     Score      │
             │              │ 1:N                          └────────────────┘
             │              ▼
             │     ┌──────────────┐
             │     │DocumentChunk │   (pgvector 768)
             │     └──────────────┘
             │
             │
             ▼
       ┌──────────┐    ┌──────────────────┐    ┌─────────────┐
       │  Alert   │    │DocumentGeneration│    │  AuditLog   │
       └──────────┘    └──────────────────┘    └─────────────┘
```

> Legenda: `1:N` — relacja jeden do wielu (FK po stronie „N"). Wszystkie
> klucze obce używają `ondelete=...` opisanych w [`entities.md`](entities.md).

---

## Najważniejsze relacje (skrót)

### Klient — kontekst
- `Customer 1:N Contract` (FK `contracts.customer_id`, `RESTRICT`)
- `Customer 1:N ContactPerson` (FK `contact_persons.customer_id`, `CASCADE`)
- `Customer 1:N Note` / `Attachment` / `ActivityLog` / `CustomerRelationScore`
  / `Alert` / `DocumentChunk`
- `Customer N:1 Company` (`RESTRICT`) — opcjonalnie
- `Customer N:1 User` (account_manager_id, `RESTRICT`) — wymagane
  (klient zawsze ma opiekuna)

### Umowy
- `Contract 1:N ContractAmendment` (`RESTRICT`)
- `Contract 1:N ContractService` (`RESTRICT`)
- `Contract 1:N Valorization` (`RESTRICT`)
- `Contract 1:N Note` (`CASCADE`)
- `Contract 1:N Attachment` (`CASCADE`)
- `Contract 1:N Alert` (`CASCADE`)
- `Contract 1:N ActivityLog` (`SET NULL`)
- `Contract.primary_document_id → Attachment` (`SET NULL`) — flagowy
  „główny" PDF umowy
- `Contract.parent_contract_id → Contract` (self-ref, `SET NULL`)

### Usługi i stawki
- `ServiceGroup` — drzewo (parent_id), materialized path (`path_id`, `path_name`).
- `Service N:1 ServiceGroup` (`RESTRICT`)
- `ContractService N:1 Contract` + `N:1 Service`. UNIQUE
  `(contract_id, service_id, valid_from)`.
- `CustomerRate N:1 ContractService` (`RESTRICT`). UNIQUE
  `(contract_service_id, year)`.
- `CustomerRate 1:N CustomerRateMonth` (`CASCADE`). UNIQUE `(rate_id, month)`,
  `month BETWEEN 1 AND 12`.
- `Valorization N:1 Contract` (`RESTRICT`). UNIQUE `(contract_id, year)`.
- `CustomerRate.valorization_id → Valorization` (`SET NULL`) — historia
  podwyżek per stawka.

### Dokumenty
- `Attachment` — meta nad plikiem w S3 (`s3_bucket`, `s3_key`, `mime_type`,
  `file_size_bytes`, `ocr_status`).
- `Attachment 1:N DocumentChunk` (`CASCADE`) — chunki tekstowe + embedding.
  Index HNSW: `idx_chunks_embedding_hnsw`.
- `Attachment.uploaded_by → User` (`SET NULL`).
- `DocumentGeneration` — meta generacji AI; zawiera FK do PDF (`attachment_pdf_id`),
  cover lettera (`cover_letter_attachment_id`), klienta i umowy.

### Audyt i alerty
- `AuditLog` — luźno powiązany (entity_type + entity_id), bez kaskad.
  Pola JSONB `old_values`, `new_values` przechowują diffy.
- `Alert` — alert bieżący (CHECK `customer_id IS NOT NULL OR contract_id IS NOT NULL`).
  W praktyce alerty są **liczone on-the-fly** przez `AlertService`, tabela
  jest przygotowana pod przyszłe persistowanie.

---

## JSONB — gdzie i po co

Tabele z polem `additional_data: JSONB` (`server_default '{}'::jsonb`):

- `companies`, `customers`, `contact_persons`
- `contracts`, `contract_services`, `valorizations`
- `services`, `notes` (n/d — uwaga, nie ma), `attachments` (jako `extracted_fields`)
- `activity_logs`
- `document_generations` ma **3 pola JSONB**: `payload` (snapshot inputów),
  `simulation` (kalkulacja), `ai_artifacts` (cover letter, rationale).

Zasada: JSONB służy **danym zmiennym** lub integracyjnym (np. metadata z
zewnętrznego systemu, pola pomocnicze). Pola **kluczowe** (status, daty,
ceny) są zawsze pełnoprawnymi kolumnami — nie schowane w JSON.

---

## pgvector — gdzie i po co

Tabela `document_chunks`:
- `embedding: Vector(768)` — model `nomic-embed-text` (Ollama).
- Index HNSW (cosine) — `m=16`, `ef_construction=64`.
- `customer_id` — denormalizacja, pre-filter przed wyszukiwaniem wektorowym.

Zob. [`jsonb-and-pgvector.md`](jsonb-and-pgvector.md).

---

## Soft delete

Tabele z `SoftDeleteMixin` mają `deleted_at TIMESTAMPTZ NULL`:

- `companies`, `customers`, `contact_persons`
- `contracts`, `notes`, `attachments`
- `services`, `service_groups` (uwaga — bez SoftDelete; sprawdź `entities.md`)

W zapytaniach **zawsze** filtruj po `deleted_at IS NULL`. Wszystkie
serwisy w `app/service/` to robią; jeśli piszesz nowe repo / serwis,
podążaj za tym wzorcem.

---

## Audit kolumny

`AuditMixin` daje `created_by`, `updated_by` (FK do `users`, `SET NULL`).
W endpointach mutujących te pola są ustawiane explicite w serwisie.

`AuditLog` (osobna tabela) zapisuje historię operacji
(`CREATE/UPDATE/DELETE/RESTORE/VIEW`) z diff JSON. **Nie** jest jeszcze
podpięty automatycznie do wszystkich endpointów — to zaplanowane
rozszerzenie.

---

## Konwencje nazewnicze (constraints)

W `models/base.py`:

```python
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}
```

Wymusza deterministyczne nazwy w autogenerowanych migracjach Alembica.
**Nie zmieniaj** tej konwencji bez świadomej decyzji — to powoduje
zbędne diffy przy `make makemigration`.

---

## Dalej

- [`entities.md`](entities.md) — opis każdej tabeli kolumna po kolumnie.
- [`enums.md`](enums.md) — wszystkie enumy domenowe.
- [`migrations.md`](migrations.md) — Alembic.
- [`jsonb-and-pgvector.md`](jsonb-and-pgvector.md).
