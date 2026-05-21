# Model danych — encje (kolumna po kolumnie)

## Cel

Szczegółowy opis każdej tabeli: kolumny, typy, FK, indeksy, ograniczenia.
Źródło prawdy = `app/models/*.py`. Ten plik jest streszczeniem dla ludzi.

> Wszystkie PK są `UUID(as_uuid=True)` z `default=uuid.uuid4`. Pole nie
> jest powtarzane w opisach kolumn poniżej.

---

## 👤 `users`

Konto wewnętrzne (synchronizowane z AD).

| Kolumna | Typ          | Constraints     | Opis                          |
|---------|--------------|-----------------|-------------------------------|
| login   | VARCHAR(100) | UNIQUE, NOT NULL| Login z AD (`HRK\login` po normalizacji) |
| email   | VARCHAR(255) | UNIQUE, NOT NULL| `{login}@hrk.eu`              |

Brak haseł — autoryzacja przez AD.

---

## 🏢 `companies`

Osoba prawna powiązana z klientem.

| Kolumna           | Typ          | Constraints   | Opis                  |
|-------------------|--------------|---------------|-----------------------|
| name              | VARCHAR(255) | NOT NULL      | Nazwa firmy           |
| nip               | VARCHAR(15)  | UNIQUE        |                       |
| regon             | VARCHAR(14)  |               |                       |
| krs               | VARCHAR(20)  |               |                       |
| address_street    | VARCHAR(255) |               |                       |
| address_city      | VARCHAR(255) |               |                       |
| address_postal    | VARCHAR(10)  |               |                       |
| address_country   | VARCHAR(2)   | DEFAULT 'PL'  |                       |
| phone, email, website | VARCHAR  |               |                       |
| is_active         | BOOLEAN      | DEFAULT true  |                       |
| additional_data   | JSONB        | DEFAULT '{}'  |                       |

Mixiny: `TimestampMixin`, `SoftDeleteMixin`.

---

## 👥 `customers`

Klient (konto CRM). **Dwie unikalne identyfikacje branżowe**: `ckk`, `ckd`.

| Kolumna              | Typ          | Constraints                      | Opis |
|----------------------|--------------|----------------------------------|------|
| ckk                  | VARCHAR(10)  | UNIQUE, NOT NULL                 | Identyfikator klienta (płaska księga klientów) |
| ckd                  | VARCHAR(10)  | UNIQUE NULL                      | Identyfikator alternatywny |
| company_id           | UUID         | FK companies.id ON DELETE RESTRICT | Powiązana firma (opcjonalnie) |
| account_manager_id   | UUID         | FK users.id ON DELETE RESTRICT, NOT NULL | Opiekun klienta — wymagany |
| status               | enum         | DEFAULT 'active'                 | `CustomerStatus` |
| segment              | VARCHAR(50)  |                                  | np. SMB / Enterprise |
| industry             | VARCHAR(100) |                                  |  |
| employee_count       | INTEGER      |                                  |  |
| payment_period_days  | INTEGER      | DEFAULT 21                       |  |
| account_number       | VARCHAR(30)  |                                  | numer rachunku |
| billing_nip          | VARCHAR(15)  |                                  | NIP do faktury (jeśli inny niż firmy) |
| billing_email        | VARCHAR(255) |                                  |  |
| invoice_nip          | VARCHAR(15)  |                                  |  |
| phone                | VARCHAR(20)  |                                  |  |
| address_*            | VARCHAR      |                                  | ulica, miasto, kod, kraj |
| additional_data      | JSONB        | DEFAULT '{}'                     |  |

Indeksy: `ckk` UNIQUE, `ckd` UNIQUE, `account_manager_id`, `company_id`,
`status`, `deleted_at`.

Mixiny: `TimestampMixin`, `SoftDeleteMixin`, `AuditMixin`.

> **Uwaga**: pierwotnie `account_manager_id` miał `ondelete=SET NULL` przy
> `nullable=False` (sprzeczność). Naprawione na `RESTRICT` — usunięcie
> opiekuna jest zablokowane, dopóki ma przypisanych klientów.

---

## 📞 `contact_persons`

Osoba kontaktowa po stronie klienta.

| Kolumna              | Typ          | Constraints   | Opis |
|----------------------|--------------|---------------|------|
| customer_id          | UUID         | FK ON DELETE CASCADE, NOT NULL | |
| first_name           | VARCHAR(100) | NOT NULL      |  |
| last_name            | VARCHAR(100) | NOT NULL      |  |
| email                | VARCHAR(255) |               |  |
| phone                | VARCHAR(20)  |               |  |
| role                 | VARCHAR(100) |               |  |
| is_primary           | BOOLEAN      | DEFAULT false |  |
| is_contract_signer   | BOOLEAN      | DEFAULT false | Osoba uprawniona do podpisu |
| additional_data      | JSONB        | DEFAULT '{}'  |  |

Indeksy: `customer_id`, `email`. Mixiny: `CreatedAtMixin`, `SoftDeleteMixin`.

---

## 📑 `contracts`

Główna umowa z klientem.

| Kolumna              | Typ          | Constraints                          | Opis |
|----------------------|--------------|--------------------------------------|------|
| customer_id          | UUID         | FK ON DELETE RESTRICT, NOT NULL      |  |
| account_manager_id   | UUID         | FK users.id ON DELETE SET NULL       | Opiekun konkretnej umowy (może być inny niż klienta) |
| contract_number      | VARCHAR(50)  | UNIQUE, NOT NULL                     |  |
| contract_type        | enum         | NOT NULL                             | `ContractType` |
| status               | enum         | DEFAULT 'draft'                      | `ContractStatus` |
| start_date           | DATE         | NOT NULL                             |  |
| end_date             | DATE         |                                      |  |
| notice_period_days   | INTEGER      | DEFAULT 90                           | Okres wypowiedzenia |
| notice_conditions    | TEXT         |                                      |  |
| billing_cycle        | enum         | DEFAULT 'monthly'                    | `BillingCycle` |
| governing_law        | VARCHAR(10)  | DEFAULT 'PL'                         |  |
| parent_contract_id   | UUID         | FK contracts.id ON DELETE SET NULL   | Umowa-rodzic (np. ramowa → SLA) |
| notes                | TEXT         |                                      |  |
| primary_document_id  | UUID         | FK attachments.id ON DELETE SET NULL | Główny PDF umowy |
| additional_data      | JSONB        | DEFAULT '{}'                         |  |

Indeksy: `contract_number` UNIQUE, `(customer_id, status)`, `end_date`,
`deleted_at`.

Mixiny: `TimestampMixin`, `SoftDeleteMixin`, `AuditMixin`.

---

## 📜 `contract_amendments`

Aneks do umowy.

| Kolumna             | Typ          | Constraints                          | Opis |
|---------------------|--------------|--------------------------------------|------|
| contract_id         | UUID         | FK ON DELETE RESTRICT, NOT NULL      |  |
| amendment_number    | VARCHAR(50)  | NOT NULL, UNIQUE razem z contract_id | uq_amendment_contract_number |
| amendment_date      | DATE         | NOT NULL                             | Data podpisania |
| effective_date      | DATE         | NOT NULL                             | Od kiedy obowiązuje |
| scope_of_change     | TEXT         | NOT NULL                             |  |
| approved_by_client  | VARCHAR(255) |                                      |  |
| approved_by_hrk     | VARCHAR(255) |                                      |  |
| document_id         | UUID         | FK attachments.id ON DELETE SET NULL | PDF aneksu |
| created_by          | UUID         | FK users.id ON DELETE SET NULL       |  |

Mixin: `CreatedAtMixin`.

---

## 🛠️ `service_groups` / `services` / `contract_services`

### `service_groups`
Hierarchia (drzewo, materialized path).

| Kolumna     | Typ          | Constraints              | Opis |
|-------------|--------------|--------------------------|------|
| parent_id   | UUID         | FK self ON DELETE RESTRICT |  |
| name        | VARCHAR(255) | NOT NULL                 |  |
| service_code| VARCHAR(20)  |                          |  |
| level       | INTEGER      | DEFAULT 1                |  |
| path_id     | VARCHAR(50)  | UNIQUE                   | Materialized path (np. `/01/03/`) |
| path_name   | VARCHAR(500) |                          | Nazwy w pełnej ścieżce |
| is_active   | BOOLEAN      | DEFAULT true             |  |

> Materialized path jest **denormalizowany**. Po zmianie nazwy lub parenta
> grupy trzeba odświeżyć `path_id`/`path_name` w dół drzewa (TODO ALF-XX).

### `services`

| Kolumna           | Typ          | Constraints                  | Opis |
|-------------------|--------------|------------------------------|------|
| group_id          | UUID         | FK ON DELETE RESTRICT, NOT NULL |  |
| name              | VARCHAR(255) | NOT NULL                     |  |
| billing_unit      | enum         | NOT NULL                     | `BillingUnit` |
| billing_frequency | enum         | DEFAULT 'monthly'            | `BillingFrequency` |
| vat_rate          | NUMERIC(4,2) | DEFAULT 23.00                |  |
| is_active         | BOOLEAN      | DEFAULT true                 |  |
| additional_data   | JSONB        | DEFAULT '{}'                 |  |

Mixiny: `CreatedAtMixin`, `SoftDeleteMixin`.

### `contract_services`

Pivot Contract ↔ Service z kontekstem (zakres, SLA, ważność).

| Kolumna           | Typ          | Constraints                              | Opis |
|-------------------|--------------|------------------------------------------|------|
| contract_id       | UUID         | FK ON DELETE RESTRICT, NOT NULL          |  |
| service_id        | UUID         | FK ON DELETE RESTRICT, NOT NULL          |  |
| scope_description | TEXT         |                                          |  |
| volume_limit      | INTEGER      |                                          | Limit wolumenu (np. liczba etatów) |
| volume_unit       | VARCHAR(20)  |                                          |  |
| sla_definition    | TEXT         |                                          |  |
| is_billable       | BOOLEAN      | DEFAULT true                             |  |
| valid_from        | DATE         | NOT NULL                                 |  |
| valid_to          | DATE         |                                          |  |
| additional_data   | JSONB        | DEFAULT '{}'                             |  |

UNIQUE `(contract_id, service_id, valid_from)` — można odnowić tę samą
usługę pod inną datą startu.

---

## 💰 `customer_rates` / `customer_rate_months` / `valorizations`

### `customer_rates`
Stawka per `ContractService` per rok.

| Kolumna             | Typ           | Constraints                          | Opis |
|---------------------|---------------|--------------------------------------|------|
| contract_service_id | UUID          | FK ON DELETE RESTRICT, NOT NULL      |  |
| valorization_id     | UUID          | FK ON DELETE SET NULL                | jeśli stawka pochodzi z waloryzacji |
| year                | INTEGER       | NOT NULL                             |  |
| base_price          | NUMERIC(10,2) | NOT NULL                             | Cena bazowa |
| discount_pct        | NUMERIC(5,2)  | DEFAULT 0.00                         | Rabat % |
| created_by          | UUID          | FK users.id ON DELETE SET NULL       |  |

UNIQUE `(contract_service_id, year)`. Mixin: `CreatedAtMixin`.

### `customer_rate_months`
Cena netto per miesiąc dla danej `CustomerRate` (12 wierszy zamiast 12 kolumn).

| Kolumna   | Typ           | Constraints                          | Opis |
|-----------|---------------|--------------------------------------|------|
| rate_id   | UUID          | FK customer_rates.id ON DELETE CASCADE, NOT NULL | |
| month     | INTEGER       | CHECK 1..12, NOT NULL                |  |
| net_price | NUMERIC(10,2) | NOT NULL                             |  |

UNIQUE `(rate_id, month)`. Bez mixinów (statyczne dane finansowe).

> Historycznie były kolumny `net_price_01` … `net_price_12`. Normalizacja
> (`1NF`) pozwala robić `WHERE month = 3` bez hardkodowania nazw kolumn.

### `valorizations`
Indeksacja stawek (wsadowa zmiana cen) per rok.

| Kolumna       | Typ           | Constraints                              | Opis |
|---------------|---------------|------------------------------------------|------|
| contract_id   | UUID          | FK ON DELETE RESTRICT, NOT NULL          |  |
| year          | INTEGER       | NOT NULL                                 |  |
| index_type    | enum          | NOT NULL                                 | `IndexType`: `GUS_CPI`, `fixed_pct`, `custom` |
| index_value   | NUMERIC(5,2)  | NOT NULL                                 | Procent (np. `4.50`) |
| planned_date  | DATE          | NOT NULL                                 |  |
| applied_date  | DATE          |                                          |  |
| status        | enum          | DEFAULT 'pending'                        | `ValorizationStatus` |
| approved_by   | UUID          | FK users.id ON DELETE SET NULL           |  |
| notes         | TEXT          |                                          |  |
| additional_data | JSONB       | DEFAULT '{}'                             |  |
| created_by    | UUID          | FK users.id ON DELETE SET NULL           |  |

UNIQUE `(contract_id, year)`. Mixin: `TimestampMixin`. Indeksy:
`(contract_id, year)`, `(status, planned_date)`.

---

## 📝 `notes`

Notatka tekstowa do klienta lub umowy.

| Kolumna     | Typ        | Constraints                              | Opis |
|-------------|------------|------------------------------------------|------|
| customer_id | UUID NULL  | FK ON DELETE CASCADE                     |  |
| contract_id | UUID NULL  | FK ON DELETE CASCADE                     |  |
| note_type   | enum       | NOT NULL                                 | `NoteType` |
| content     | TEXT       | NOT NULL                                 |  |
| created_by  | UUID NULL  | FK users.id ON DELETE SET NULL           |  |

CHECK: **przynajmniej** jeden z `customer_id`, `contract_id` musi być
wypełniony. Mixiny: `TimestampMixin`, `SoftDeleteMixin`.

---

## 📄 `attachments`

Plik w S3 z metadanymi.

| Kolumna           | Typ           | Constraints                              | Opis |
|-------------------|---------------|------------------------------------------|------|
| company_id        | UUID NULL     | FK ON DELETE SET NULL                    |  |
| customer_id       | UUID NULL     | FK ON DELETE CASCADE                     |  |
| contract_id       | UUID NULL     | FK ON DELETE CASCADE                     |  |
| amendment_id      | UUID NULL     | FK ON DELETE SET NULL                    |  |
| document_type     | enum          | NOT NULL                                 | `DocumentType` |
| original_filename | VARCHAR(500)  | NOT NULL                                 |  |
| s3_bucket         | VARCHAR(255)  | NOT NULL                                 |  |
| s3_key            | VARCHAR(1000) | UNIQUE, NOT NULL                         |  |
| mime_type         | VARCHAR(100)  |                                          |  |
| file_size_bytes   | BIGINT        |                                          |  |
| ocr_status        | enum          | DEFAULT 'pending'                        | `OcrStatus` |
| extracted_text    | TEXT          |                                          | Surowy tekst (opcjonalnie) |
| extracted_fields  | JSONB         | DEFAULT '{}'                             | Pola strukturalne (np. nr umowy) |
| version           | INTEGER       | DEFAULT 1                                |  |
| uploaded_by       | UUID NULL     | FK users.id ON DELETE SET NULL           |  |

Indeksy: `company_id`, `customer_id`, `contract_id`, **partial index**
`ocr_status IN ('pending','processing')` → kolejka do przetworzenia.

Mixiny: `CreatedAtMixin`, `SoftDeleteMixin`.

---

## 🔍 `document_chunks`

Tekstowy chunk + embedding (RAG).

| Kolumna       | Typ          | Constraints                          | Opis |
|---------------|--------------|--------------------------------------|------|
| attachment_id | UUID         | FK ON DELETE CASCADE, NOT NULL       |  |
| chunk_index   | INTEGER      | NOT NULL                             | UNIQUE razem z attachment_id |
| content       | TEXT         | NOT NULL                             |  |
| token_count   | INTEGER      |                                      |  |
| page_number   | INTEGER      |                                      |  |
| bbox          | JSONB        |                                      | `{x0, y0, x1, y1}` |
| customer_id   | UUID NULL    | FK ON DELETE CASCADE                 | Pre-filter dla wyszukiwania |
| section_title | VARCHAR(500) |                                      |  |
| embedding     | vector(768)  | NOT NULL                             | pgvector |

Indeksy:
- `idx_chunks_attachment`, `idx_chunks_customer`
- HNSW: `idx_chunks_embedding_hnsw` (`vector_cosine_ops`, `m=16`,
  `ef_construction=64`)

Mixin: `CreatedAtMixin`.

---

## 🧾 `document_generations`

Snapshot generacji AI (preview/finalize/accept).

| Kolumna                    | Typ          | Constraints                    | Opis |
|----------------------------|--------------|--------------------------------|------|
| customer_id                | UUID         | FK ON DELETE CASCADE, NOT NULL |  |
| contract_id                | UUID NULL    | FK ON DELETE SET NULL          |  |
| amendment_id               | UUID NULL    | FK ON DELETE SET NULL          | Powiązanie z aneksem |
| attachment_pdf_id          | UUID NULL    | FK ON DELETE SET NULL          | PDF aneksu |
| cover_letter_attachment_id | UUID NULL    | FK ON DELETE SET NULL          | PDF pisma przewodniego |
| template_key               | VARCHAR(100) | NOT NULL                       | np. `amendment_valorization` |
| template_version           | VARCHAR(20)  | NOT NULL                       | semver szablonu |
| status                     | enum         | DEFAULT 'draft'                | `DocumentGenerationStatus` |
| payload                    | JSONB        | DEFAULT '{}'                   | Snapshot inputów (params + dane klienta/umowy) |
| simulation                 | JSONB        | DEFAULT '{}'                   | Wynik kalkulacji (per usługa, sumy roczne) |
| ai_artifacts               | JSONB        | DEFAULT '{}'                   | `{rationale, cover_letter, model, prompt_hash, tone}` |
| pdf_sha256                 | VARCHAR(64)  |                                | SHA-256 zaakceptowanego PDF |
| generated_by               | UUID NULL    | FK users.id ON DELETE SET NULL |  |
| accepted_by                | UUID NULL    | FK users.id ON DELETE SET NULL |  |

Mixin: `TimestampMixin`. Indeksy: `customer_id`, `contract_id`,
`(status, created_at)`.

---

## 📜 `activity_logs`

Niezmienialny dziennik aktywności CRM.

| Kolumna        | Typ        | Constraints                          | Opis |
|----------------|------------|--------------------------------------|------|
| customer_id    | UUID NULL  | FK ON DELETE CASCADE                 |  |
| contract_id    | UUID NULL  | FK ON DELETE SET NULL                |  |
| activity_type  | enum       | NOT NULL                             | `ActivityType` |
| description    | TEXT       | NOT NULL                             |  |
| performed_by   | UUID NULL  | FK users.id ON DELETE SET NULL       |  |
| activity_date  | TIMESTAMPTZ| DEFAULT now()                        |  |
| additional_data| JSONB      | DEFAULT '{}'                         |  |

Mixin: `CreatedAtMixin`. **Brak** `updated_at` / `deleted_at` — log jest
append-only.

---

## 🚦 `customer_relation_scores`

Periodyczny score relacji z klientem (AI lub manualny).

| Kolumna       | Typ          | Constraints                              | Opis |
|---------------|--------------|------------------------------------------|------|
| customer_id   | UUID         | FK ON DELETE CASCADE, NOT NULL           |  |
| score_date    | DATE         | NOT NULL                                 | UNIQUE razem z customer_id |
| score_label   | enum         | NOT NULL                                 | `ScoreLabel` |
| score_value   | NUMERIC(3,2) | CHECK 0..1, NOT NULL                     |  |
| reasoning     | TEXT         |                                          |  |
| calculated_by | enum         | DEFAULT 'ai'                             | `CalculatedBy`: `ai` / `manual` |

Mixin: `CreatedAtMixin`. UNIQUE `(customer_id, score_date)`.

---

## 🚨 `alerts`

Alert „do zrobienia" dla opiekuna.

| Kolumna        | Typ        | Constraints                          | Opis |
|----------------|------------|--------------------------------------|------|
| customer_id    | UUID NULL  | FK ON DELETE CASCADE                 |  |
| contract_id    | UUID NULL  | FK ON DELETE CASCADE                 |  |
| alert_type     | enum       | NOT NULL                             | `AlertType` |
| entity_type    | VARCHAR(50)|                                      | (np. `valorization`) |
| entity_id      | UUID       |                                      |  |
| status         | enum       | DEFAULT 'open'                       | `AlertStatus` |
| trigger_date   | DATE       | NOT NULL                             |  |
| days_before    | INTEGER    |                                      |  |
| message        | TEXT       | NOT NULL                             |  |
| assigned_to    | UUID NULL  | FK users.id ON DELETE SET NULL       |  |
| acknowledged_at| TIMESTAMPTZ|                                      |  |

CHECK: `customer_id IS NOT NULL OR contract_id IS NOT NULL`. Mixin:
`CreatedAtMixin`.

> W obecnym kodzie alerty są **wyliczane on-the-fly** w `AlertService`,
> a tabela jest gotowa pod przyszłe persistowanie / acknowledge.

---

## 🧾 `audit_logs`

Niezmienialny audyt (CREATE/UPDATE/DELETE/RESTORE/VIEW).

| Kolumna     | Typ         | Constraints                          | Opis |
|-------------|-------------|--------------------------------------|------|
| user_id     | UUID NULL   | FK users.id ON DELETE SET NULL       |  |
| entity_type | VARCHAR(50) | NOT NULL                             | np. `Contract`, `Customer` |
| entity_id   | UUID        | NOT NULL                             |  |
| action      | enum        | NOT NULL                             | `AuditAction` |
| old_values  | JSONB       |                                      | Diff przed |
| new_values  | JSONB       |                                      | Diff po |
| ip_address  | VARCHAR(45) |                                      |  |
| user_agent  | VARCHAR(500)|                                      |  |

Mixin: `CreatedAtMixin`. Brak FK z kaskadami → log przetrwa kasowanie encji.

---

## Dalej

- [`enums.md`](enums.md) — pełna lista enumów + dozwolone wartości.
- [`migrations.md`](migrations.md) — Alembic.
- [`jsonb-and-pgvector.md`](jsonb-and-pgvector.md).
