# Workflow — alerty

## Cel

Wyjaśnić, **skąd się biorą alerty** w HRK CRM („umowa wygasa za 30
dni", „waloryzacja po terminie") — kto je wylicza, kiedy i jak są
prezentowane.

> Zob. też [`../backend/api-reference.md#-alerts`](../backend/api-reference.md)
> oraz [`../data-model/entities.md`](../data-model/entities.md) → `alerts`.

---

## Kluczowa decyzja: **alerty są liczone on-the-fly**

W obecnym MVP:
- ❌ **Brak** crona / harmonogramu / workera.
- ❌ **Brak** persistowania alertów w tabeli `alerts` przez serwis.
- ✅ Alerty są generowane **na żądanie** przez `AlertService.get_alerts(...)`.

Konsekwencje:
- Ten sam alert dostaje **świeży UUID** za każdym razem (nie służy do
  trwałych „acknowledged"/"snoozed").
- Brak historii „kiedy alert był otwarty" — to dane wirtualne.
- Tabela `alerts` istnieje pod **przyszłą funkcję persistowania**.

> Plan rozszerzenia: scheduler (cron) → snapshot do `alerts` z
> deduplikacją po `(alert_type, entity_id, trigger_date)`.

---

## Endpoint

```
GET /api/v1/alerts?account_manager_id={user_id}        → list[AlertRead]
WS  /api/v1/alerts/ws/{client_id}                      ← WebSocket
```

`AlertRead` (uproszczony):
```ts
{
  id: UUID,
  type: 'contract_expiry_30' | 'contract_expiry_60' | 'contract_expiry_90'
      | 'valorization_overdue' | 'valorization_pending'
      | 'no_contact',
  severity: 'urgent' | 'high' | 'medium',
  title: string,
  detail: string,
  customer_id: UUID | null,
  contract_id: UUID | null,
  due_date: Date | null,
  created_at: datetime,
}
```

---

## Reguły alertów (w `AlertService`)

### 1. Wygasające umowy

Źródło: `Contract.end_date`. Filtr: `status != TERMINATED`,
`deleted_at IS NULL`, `end_date BETWEEN today AND today + 90 days`.

| Okno (dni do końca) | Typ                  | Severity |
|---------------------|----------------------|----------|
| 0 ≤ days ≤ 30       | `contract_expiry_30` | urgent   |
| 30 < days ≤ 60      | `contract_expiry_60` | high     |
| 60 < days ≤ 90      | `contract_expiry_90` | medium   |

Komunikat: `"Umowa {contract_number} wygasa za {days_left} dni."`

> Filtr `account_manager_id` jest stosowany przez JOIN z `Customer`:
> `WHERE Customer.account_manager_id = :uid`.

### 2. Waloryzacje

Źródło: `Valorization.planned_date` + `status`.

| Warunek                                            | Typ                      | Severity |
|----------------------------------------------------|--------------------------|----------|
| `planned_date < today` AND `status != approved/applied` | `valorization_overdue`   | urgent   |
| `0 ≤ planned_date - today ≤ 30` AND `status=pending`   | `valorization_pending`   | high     |

### 3. Brak kontaktu

Logika: dla każdego aktywnego klienta sprawdź ostatnią aktywność:

```python
latest_act = SELECT MAX(activity_date) FROM activity_logs WHERE customer_id IN (...)
if latest_act:
    days = (today - latest_act.date()).days
else:
    days = (today - customer.created_at.date()).days

if days > 90:
    alert("no_contact", severity="medium",
          detail=f"Brak kontaktu z klientem od ponad {days} dni.")
```

Próg: **90 dni** (hardcoded; do parametryzacji w przyszłości).

---

## Dashboard KPI

`GET /api/v1/dashboard/kpi?account_manager_id={uid}` zwraca agregaty
liczbowe (ten sam serwis, inne metody):

```json
{
  "active_customers": 12,
  "active_contracts": 18,
  "contracts_expiring_30d": 2,
  "valorizations_pending": 3,
  "valorizations_overdue": 1
}
```

Liczone JOIN-ami + `COUNT()`. Zob. `AlertService.get_dashboard_kpi()`.

---

## Frontend

### Hook
```ts
const { data: alerts } = useQuery({
  queryKey: ['alerts', user.id],
  queryFn: () => apiClient.get(`/api/v1/alerts?account_manager_id=${user.id}`),
  staleTime: 60_000,
})
```

### WebSocket — live update
```ts
useAlertWebSockets(user.id)
// → otwiera ws://.../api/v1/alerts/ws/{user.id}
// → na onmessage typu 'alert' robi queryClient.invalidateQueries(['alerts'])
```

> Backend dziś **nie pushuje** automatycznie nowych alertów po WS —
> manager jest gotowy, ale brak feedu (alerty są generowane on-the-fly).
> Do podpięcia: cron co X minut + push przez `manager.broadcast(...)`.

### UI

- `ManagerDashboardPage` — lista alertów filtrowana per opiekun
  (`account_manager_id={user.id}`).
- `DashboardPage` — alerty zespołowe (bez filtra).
- Severity:
  - `urgent` — czerwony badge
  - `high` — pomarańczowy
  - `medium` — żółty

---

## Antywzorce

- ❌ Cache alertów po stronie FE > 60 s — dane się przeterminowują
  (każdy dzień zmienia okna 30/60/90).
- ❌ Próba persistowania `id` z alertu (random UUID per request).
- ❌ Pomijanie filtra `account_manager_id` w widokach opiekuna —
  zobaczy alerty nieswoich klientów.

---

## Plan na produkcję

1. Worker co 15 min:
   - oblicza alerty per klient
   - zapisuje do `alerts` z deduplikacją
   - pushuje przez WS do online'owych
2. UI dostaje akcje **acknowledge / snooze / resolve** — modyfikuje
   wiersz w `alerts`.
3. Audit trail w `audit_logs`.
4. Notyfikacje email per próg krytyczny.

---

## Dalej

- [`valorization.md`](valorization.md) — pełny cykl waloryzacji
  (źródło alertu „valorization_*").
- [`contracts.md`](contracts.md) — co znaczy „umowa wygasa".
