# Reports — Activity Log

## Endpoint

`GET /api/v1/reports/activity`

### Params

| Param | Type | Required | Default | Opis |
|---|---|---|---|---|
| `current_user_id` | UUID | TAK | — | UUID zalogowanego usera (z Redux store) |
| `period` | int | nie | 30 | Liczba dni: 7/30/90/180/365 |
| `user_id` | UUID | nie | — | Filter po wykonawcy (tylko admin) |
| `customer_id` | UUID | nie | — | Filter po kliencie |
| `activity_type` | string | nie | — | Enum: meeting/email/note/document/verification/call/system |
| `limit` | int | nie | 50 | Max 200 |
| `offset` | int | nie | 0 | Paginacja |

### Response

```json
{
  "items": [ActivityLogReportItem],
  "kpi": { "events_count": 0, "meetings_count": 0, "documents_count": 0, "notes_count": 0 },
  "total": 0
}
```

`ActivityLogReportItem` zawiera `performed_by_login` (JOIN z users) i `is_own` (bool — czy wykonał current_user).

## Role-based filtering

| Department | Zakres |
|---|---|
| `Administrator IT` | Wszystkie aktywności w systemie |
| Pozostałe | `performed_by = current_user` + aktywności na klientach gdzie `account_manager_id = current_user` |

## Model User — pole `department`

Dodane pole `department: str | null` do tabeli `users`.  
Uzupełniane przy logowaniu AD z `groups[0]`.  
Migracja: `b1c2d3e4f5a6_add_user_department`.

## Pliki

- `src/app/models/user.py` — pole `department`
- `src/app/schemas/user.py` — `UserRead.department`
- `src/app/service/ad_login.py` — wypełnianie `department` z AD groups
- `src/app/repo/activity.py` — `list_for_admin`, `list_for_user_scope`, `get_kpi_admin`, `get_kpi_user_scope`
- `src/app/service/reports.py` — `ReportsService`
- `src/app/api/v1/reports.py` — router
- `frontend/src/hooks/useActivityLog.ts` — TanStack Query hook
- `frontend/src/pages/ReportsPage.tsx` — strona raportów
