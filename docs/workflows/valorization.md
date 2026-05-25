# Workflow — waloryzacja stawek

## Cel

Opisać pełny cykl **waloryzacji** w HRK CRM: planowanie → akceptacja
→ aplikacja na stawkach → dokument (aneks). To jeden z dwóch głównych
flow biznesowych w MVP (drugi to obsługa klienta).

---

## Pojęcia

- **Waloryzacja** = roczna indeksacja cen umowy o wskaźnik (np. CPI z GUS).
- **Stawka** (`CustomerRate`) = cena per `ContractService` per rok.
- **Stawka miesięczna** (`CustomerRateMonth`) = 12 wierszy net_price
  (jeden per miesiąc) na każdą stawkę.

---

## Stany waloryzacji (`ValorizationStatus`)

```
   pending  →  approved  →  applied
                      ↘
                       rejected
```

| Status | Opis |
|---|---|
| `pending` | Zaplanowana, jeszcze nie zaakceptowana. Generuje alerty. |
| `approved` | Zaakceptowana, ale jeszcze nie zaaplikowana na stawkach. |
| `applied` | Zaaplikowana — nowe `CustomerRate` mają `valorization_id`. |
| `rejected` | Odrzucona (np. negocjacje z klientem). |

---

## Encja `Valorization`

```
contract_id  → który kontrakt
year         → którego roku dotyczy podwyżka
index_type   → GUS_CPI | fixed_pct | custom
index_value  → procent (np. 4.50)
planned_date → kiedy ma wejść
applied_date → kiedy faktycznie zaaplikowana
status       → pending | approved | applied | rejected
approved_by  → user_id
notes        → komentarz
```

UNIQUE `(contract_id, year)` — jedna waloryzacja na umowę na rok.

---

## Flow operacyjny

```
1. PLANOWANIE
   - Account manager tworzy Valorization z index_type / value / planned_date
   - Status: pending
   - System generuje alert "valorization_pending" gdy planned_date - today ≤ 30

2. OPCJONALNIE: PODGLĄD AI
   - Manager otwiera DocumentWizard (template: amendment_valorization)
   - System symuluje: per usługa → current_effective_price * (1 + index/100) → delta
   - Manager widzi summary (delta margin, weighted index, per-service breakdown)
   - LLM generuje rationale + cover letter (narracja)
   - Render PDF z DRAFT watermark, status PREVIEW
   - DocumentGeneration nie ma wpływu na samą Valorization — to równoległy proces

3. AKCEPTACJA WALORYZACJI
   - Manager edytuje status: pending → approved
   - approved_by = current_user
   - Stawki nie są jeszcze zmieniane

4. APLIKACJA
   - Manager (lub serwis) tworzy nowe CustomerRate dla każdej ContractService:
       valorization_id = <id>
       year = valorization.year
       base_price = old_base_price * (1 + index_value/100)
       discount_pct = old_discount_pct (nie zmienia się)
   - Tworzy 12x CustomerRateMonth (per miesiąc)
   - Aktualizuje Valorization.status = applied + applied_date = today

5. AKCEPTACJA DOKUMENTU AI (jeśli generowany)
   - Manager klika Accept w DocumentWizard
   - DocumentGeneration: PREVIEW → ACCEPTED
   - Czysty PDF (bez DRAFT) ląduje w Attachments z ocr_status=pending
   - Background task indeksuje w RAG
   - PDF jest dostępny dla klienta (do wysyłki / podpisu)

6. WYSYŁKA / PODPIS
   - Manualnie lub przez integrację e-podpis (poza systemem dziś)
   - Po podpisie: ContractAmendment + nowe Attachment (DocumentType.AMENDMENT)
```

---

## Symulator (`document_generation/simulator.py`)

Pure Python, dostaje:
- `contract: Contract` (z `contract_services` eager-loaded)
- `rates_by_cs: dict[UUID, CustomerRate]` (aktualna stawka per usługa)
- `service_names: dict[UUID, str]`
- `params: ValorizationParams`

Zwraca `SimulationSummary` (zob. [`../ai/document-generation.md`](../ai/document-generation.md)).

Per usługa kalkuluje:
```
proposed_base_price       = current_base_price * (1 + applied_index_pct/100)
current_effective_price   = current_base_price * (1 - discount_pct/100)
proposed_effective_price  = proposed_base_price * (1 - discount_pct/100)
delta_per_period          = proposed_effective_price - current_effective_price
delta_yearly              = delta_per_period * periods_per_year(billing_cycle)
```

`periods_per_year`:
- `monthly` → 12
- `quarterly` → 4
- `annual` → 1
- `one_time` / `null` → 1

### Custom override per usługa

Operator może w `params.services[]` zaznaczyć `include=False` (wyłączyć
usługę z waloryzacji) lub `custom_index_pct` (inny indeks niż ogólny).

---

## API

```
GET    /api/v1/valorizations?contract_id=...&year=...&status=...
POST   /api/v1/valorizations
GET    /api/v1/valorizations/{id}
PATCH  /api/v1/valorizations/{id}     # zmiana statusu / zatwierdzenie
DELETE /api/v1/valorizations/{id}
```

---

## Alerty powiązane

Generowane przez `AlertService`:
- `valorization_pending` — `0 ≤ planned_date - today ≤ 30` AND `status=pending`.
- `valorization_overdue` — `planned_date < today` AND `status NOT IN (approved, applied)`.

Zob. [`alerts.md`](alerts.md).

---

## Aplikacja stawek — gotcha

Gdy `Valorization.status` zmienia się na `applied`, **system NIE** robi
automatycznie INSERT do `customer_rates`. To jest manualne działanie
operatora (FE → POST `/customer-rates`).

> Plan: dodać akcję `POST /valorizations/{id}/apply` która generuje
> nowe stawki + monthly rows w jednej transakcji.

---

## Frontend

`ValorizationPage` (`/valorization`):
- Tabela waloryzacji per opiekun (filtr `?account_manager_id=...` lub
  `?contract_id=...`).
- Akcje per row: **Edytuj**, **Akceptuj**, **Odrzuć**.
- „Wygeneruj aneks" → otwiera `DocumentWizard` z preselekcją.

`DocumentWizard` (`features/documentGeneration/`):
- Krok 1: wybór klienta + umowy (jeśli nie był poprzednio przekazany).
- Krok 2: parametry waloryzacji (`index_type`, `index_value`, opcje per
  usługa, ton, dodatkowe instrukcje dla LLM).
- Krok 3: preview (tabelka + delta + estimate).
- Krok 4: finalize (generuje PDF z DRAFT, status PREVIEW).
- Krok 5: accept (czysty PDF, status ACCEPTED).

---

## Audit

Zmiana stawek jest **kandydatem** do `audit_logs` — obecnie nie jest
podpięty automatycznie. Plan:
- `AuditLog(entity_type="Valorization", action="UPDATE",
  old_values={status:pending}, new_values={status:approved}, ...)`
- Generowane w `ValorizationService.update_status()`.

---

## Dalej

- [`document-generation.md`](document-generation.md) — flow generowania
  aneksu od strony UI.
- [`../ai/document-generation.md`](../ai/document-generation.md) — od
  strony serwisu.
- [`contracts.md`](contracts.md) — pełny cykl umowy.
