# Enumy domenowe

## Cel

Wszystkie enumy używane w schemacie i API. Źródło prawdy:
[`backend/src/app/models/enums.py`](../../backend/src/app/models/enums.py).

---

## Konwencja

```python
class CustomerStatus(enum.StrEnum):
    ACTIVE = "active"
    ...
```

- Bazowa klasa: `enum.StrEnum` (Python 3.11+) — wartości serializują się
  jako stringi, są też `str` przez dziedziczenie.
- W SQLAlchemy:
  ```python
  sa.Enum(MyEnum,
          name="myenum",
          create_constraint=False,
          native_enum=False,
          values_callable=lambda x: [e.value for e in x])
  ```
  - **`native_enum=False`** = wartości są `VARCHAR` w PostgreSQL.
  - Plus: brak `CREATE TYPE` ⇒ żadnych `ALTER TYPE … ADD VALUE`
    przy dodawaniu nowej wartości.
  - Minus: brak twardej walidacji po stronie DB (Python ma ją zawsze).

> Dodanie nowej wartości = edycja enuma + ewentualnie obsługa w
> serwisie/UI. Nie ma migracji DDL.

---

## 👤 Users

### `UserRole`
```
admin              # pełen dostęp
account_manager    # opiekun klienta
manager            # przełożony / Specjalista HR
viewer             # tylko odczyt
```

> W kodzie role są w schemacie, ale **nie są jeszcze enforce'owane**
> w endpointach (zob. [`../auth/permissions.md`](../auth/permissions.md)).
> Filtrowanie sidebar / dashboard po `user.department` w
> `frontend/src/components/layout/AppSidebar.tsx`.

---

## 👥 Customers

### `CustomerStatus`
```
active            # aktywny klient
churn_risk        # ryzyko odejścia
needs_attention   # wymaga interwencji
inactive          # nieaktywny / zamknięty
```

---

## 📑 Contracts

### `ContractType`
```
ramowa            # umowa ramowa
aneks             # aneks (uwaga: aneksy też są ContractAmendment!)
SLA               # umowa SLA
DPA               # Data Processing Agreement
PPK               # umowa PPK
inne              # pozostałe
```

### `ContractStatus`
```
draft, signed, active, expiring, terminated
```

`expiring` jest stanem pomocniczym — może być ustawiane przez serwis,
gdy `end_date - today <= notice_period_days`.

### `BillingCycle`
```
monthly, quarterly, annual, one_time
```

---

## 📝 Notes

### `NoteType`
```
meeting, call, internal, client_request, other
```

---

## 📄 Documents

### `DocumentType`
```
contract, amendment, power_of_attorney,
DPA, PPK, report, cover_letter, other
```

### `OcrStatus`
```
pending      # czeka na chunking/OCR
processing   # background task w toku
done         # chunki zindeksowane (RAG widzi)
failed       # błąd, dokument widoczny ale bez RAG
skipped      # nie podlega chunkingowi (np. draft AI generation)
```

---

## 📜 Activities

### `ActivityType`
```
meeting, email, note, document, verification, call, system
```

---

## 🚦 Customer scoring

### `ScoreLabel`
```
good, needs_attention, churn_risk
```

### `CalculatedBy`
```
ai, manual
```

---

## 🚨 Alerts

### `AlertType`
```
contract_expiry        # umowa kończy się
valorization_overdue   # waloryzacja po terminie
no_contact             # brak kontaktu z klientem
high_discount          # podejrzanie wysoki rabat
contract_notice        # okres wypowiedzenia
custom                 # ręcznie dodany
```

### `AlertStatus`
```
open, acknowledged, resolved, snoozed
```

> W obecnym `AlertService` używamy też dynamicznych typów string:
> `contract_expiry_30 / 60 / 90`, `valorization_pending`. Nie są one
> w enum (alerty są obecnie generowane on-the-fly, nie persystowane).

---

## 🛠️ Services

### `BillingUnit`
```
per_person   # za etat
ryczalt      # ryczałt
per_hour     # za godzinę
per_doc      # za dokument
per_item     # za sztukę
```

### `BillingFrequency`
```
monthly, quarterly, one_time, on_demand
```

---

## 📈 Valorizations

### `IndexType`
```
GUS_CPI       # wskaźnik CPI z GUS
fixed_pct     # stały procent
custom        # ustalony indywidualnie
```

### `ValorizationStatus`
```
pending, approved, applied, rejected
```

---

## 🧾 Document generations

### `DocumentGenerationStatus`
```
draft         # początkowy podgląd, brak PDF
preview       # wyrenderowany PDF z watermarkiem DRAFT
finalized     # PDF zalockowany, czeka na akceptację
accepted      # zaakceptowany, czysty PDF, indeksowany w RAG
sent          # wysłany do klienta
superseded    # zastąpiony nowszą wersją
rejected      # odrzucony
```

### `DocumentTone`
Ton stylistyczny dla generowanego pisma przewodniego / uzasadnienia.
```
formal, neutral, warm, assertive
```

---

## 🧾 Audit

### `AuditAction`
```
CREATE, UPDATE, DELETE, RESTORE, VIEW
```

(Wartości są UPPERCASE — odstępstwo od konwencji innych enumów.
Wynika z roli audytowej i zwyczaju w systemach księgowych.)
