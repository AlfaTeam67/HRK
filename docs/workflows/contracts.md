# Workflow — umowy i aneksy

## Cel

Opisać cykl życia umowy w HRK CRM, od draftu do wygaśnięcia, oraz
relacje umowa ↔ aneks ↔ usługi ↔ stawki.

---

## Stany umowy (`ContractStatus`)

```
draft  →  signed  →  active  →  expiring  →  terminated
```

| Status      | Opis |
|-------------|------|
| `draft`     | W trakcie przygotowania, nie podpisana. |
| `signed`    | Podpisana przez obie strony, jeszcze nie obowiązuje. |
| `active`    | Obowiązująca (`start_date <= today < end_date`). |
| `expiring`  | Pomocniczy — gdy `end_date - today <= notice_period_days`. |
| `terminated`| Wygasła lub wypowiedziana. |

> `expiring` może być ustawiany ręcznie lub przez serwis. Alerty
> systemowe **nie** zmieniają statusu — generują tylko powiadomienia.

---

## Hierarchia umów

`Contract.parent_contract_id → Contract` — pozwala modelować:

```
Umowa ramowa (CustomerXYZ ramowa 2024)
├── SLA Payroll
├── DPA
└── Aneks 01/2025  (parent_contract_id = ramowa.id)
```

`ContractAmendment` to **osobna encja** (nie kolejna `Contract`).
Aneksy są zdarzeniami zmieniającymi parametry umowy (zakres, daty,
ceny) bez tworzenia nowej umowy.

---

## Encje powiązane

```
Contract
├── ContractService[]      ← jakie usługi w jakim zakresie / SLA
│     └── CustomerRate[]   ← cena per rok
│            └── CustomerRateMonth[12]   ← cena per miesiąc
├── Valorization[]         ← roczne podwyżki
├── ContractAmendment[]    ← aneksy
├── Attachment[]           ← PDF-y (umowa + załączniki)
│     └── primary_document_id  ← jeden „główny" PDF na flagą
├── Note[]                 ← notatki
├── ActivityLog[]          ← log zmian
└── Alert[]                ← alerty (wygasanie, waloryzacja)
```

---

## API umów

```
GET    /api/v1/contracts?company_id=&customer_id=&statuses=&start_from=&end_from=&...
POST   /api/v1/contracts
GET    /api/v1/contracts/{id}
PATCH  /api/v1/contracts/{id}
DELETE /api/v1/contracts/{id}                      # soft delete

GET    /api/v1/contracts/{id}/services
POST   /api/v1/contracts/{id}/services             # podpiąć usługę
DELETE /api/v1/contracts/{id}/services/{rid}       # odpiąć usługę
```

Filtry list:
- `company_id` / `customer_id` — który podmiot.
- `statuses` (multi enum) — `draft,active,expiring`.
- `start_from/to`, `end_from/to` — zakresy dat.

---

## Cykl życia (operacyjnie)

```
1. UTWORZENIE
   - Manager tworzy Contract z status=draft
   - contract_number, contract_type, start_date, billing_cycle
   - Przypisanie account_manager_id (może być inny niż klienta)

2. PODPIĘCIE USŁUG
   - Per usługa: POST /contracts/{id}/services
       {
         service_id, scope_description, volume_limit,
         valid_from, valid_to (opcjonalnie),
         is_billable=true,
       }

3. STAWKI
   - Per ContractService: POST /customer-rates
       { contract_service_id, year, base_price, discount_pct }
   - Per stawka: 12x POST /customer-rate-months (lub bulk)

4. UPLOAD UMOWY
   - POST /api/v1/documents (multipart) z document_type=contract
   - Po background tasku: ocr_status=done, dokument w RAG
   - Opcjonalnie: ustaw primary_document_id

5. PODPIS
   - status: draft → signed → active

6. ALERTY (90/60/30 dni)
   - AlertService.get_alerts() generuje on-the-fly

7. WALORYZACJA (zob. valorization.md)
   - Coroczne (Valorization year+1) → nowe CustomerRate
   - Opcjonalnie: aneks (ContractAmendment) generowany przez DocumentWizard

8. KONIEC
   - Przy end_date osiągniętym → status=terminated (manualnie lub serwis)
   - Soft delete (deleted_at) gdy całkowite usunięcie z UI
```

---

## Primary document

`Contract.primary_document_id` jest opcjonalnym wskaźnikiem na **główny
PDF** umowy w `attachments`. Używany przez UI do podglądu jednym kliknięciem.

Konwencja:
- Dokument musi mieć `document_type=contract` lub `amendment`.
- Tylko jeden primary per Contract (kolumna nie ma constraintu UNIQUE,
  ale UI tak traktuje).
- Po regeneracji aneksu można zmienić wskaźnik na nowy PDF.

---

## Aneksy (`ContractAmendment`)

```
contract_id        → który kontrakt
amendment_number   → np. "01/2025" (UNIQUE w obrębie contract_id)
amendment_date     → kiedy podpisany
effective_date     → od kiedy obowiązuje
scope_of_change    → opis zmian (text)
approved_by_client → imię i nazwisko (string, nie FK)
approved_by_hrk    → ditto
document_id        → FK Attachment (PDF aneksu)
```

UNIQUE `(contract_id, amendment_number)`.

> Aneksy generowane przez `DocumentWizard` (waloryzacja) tworzą
> `DocumentGeneration` + `Attachment`. Czy automatycznie tworzą wpis
> `ContractAmendment` — TODO (obecnie manualne).

---

## Walidacje

W `ContractService.create_contract` / `update_contract` (`app/service/contracts.py`):

- `start_date < end_date` (jeśli end_date podane).
- `contract_number` unikalny.
- `customer_id` musi istnieć i być nieskasowany.
- `account_manager_id` (gdy podany) musi być `User`.

W `attach_service_to_contract`:
- `valid_from < valid_to` (jeśli oba podane).
- `(contract_id, service_id, valid_from)` unikalne (UNIQUE constraint).

---

## Frontend

`ContractsPage` (`/contracts`):
- Tabela z filtrami + szybki wyszukiwacz.
- Modal `ContractModal` (z `features/contracts/`):
  - Tab **Dane podstawowe** — formularz Contract.
  - Tab **Usługi** — `ContractService` per umowa, edycja inline.
  - Tab **Aneksy** — lista `ContractAmendment` + przycisk „Generuj aneks"
    (otwiera `DocumentWizard`).
  - Tab **Załączniki** — `UploadWizard`, lista `Attachment`-ów.

---

## Audit i alerts

- `audit_logs` — kandydat do logowania (TODO).
- `alerts` — generowane on-the-fly per umowa (zob. [`alerts.md`](alerts.md)).
- `activity_logs` — log działań CRM (notatki, spotkania, weryfikacje).

---

## Dalej

- [`valorization.md`](valorization.md) — roczna indeksacja stawek.
- [`document-upload.md`](document-upload.md) — wgranie PDF umowy do RAG.
- [`document-generation.md`](document-generation.md) — generowanie aneksu.
