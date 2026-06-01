# Plan: Reports — activity log z role-based filtering

## Zakres

11 plików + migracja DB.

---

## Backend (9 plików)

### 1. `models/user.py`
Dodać: `department: Mapped[str | None] = mapped_column(String(100), nullable=True)`

### 2. `schemas/user.py`
Dodać `department: str | None = None` do `UserRead` (tylko read, nie UserBase — pole systemowe).

### 3. `service/ad_login.py`
- `_build_user_payload(login, groups)` → department = groups[0] if groups else None
- Re-login (existing_user): zaktualizować department jeśli się zmienił → `repo.update(existing_user, {"department": ...})`

### 4. `schemas/activity.py`
Dodać:
- `ActivityKPI` — events_count, meetings_count, documents_count, notes_count
- `ActivityLogReportItem` — rozszerza ActivityLogRead o `performed_by_login: str | None`, `is_own: bool`
- `ActivityLogReportResponse` — items, kpi, total

### 5. `repo/activity.py`
Dodać:
- `list_for_reports(*, user_id, customer_id, activity_type, period_days, limit, offset, admin_user_id_filter)` → JOIN z users dla loginu
- `list_for_user_scope(*, user_id, customer_id, activity_type, period_days, limit, offset)` → WHERE (performed_by=user OR customer IN managed_customers OR contract IN managed_contracts)
- `get_kpi_for_scope(scope_stmt)` → COUNT z groupby activity_type

### 6. `service/reports.py` (NOWY)
- `ReportsService(db)` — standalone jak AlertService
- `get_activity_report(current_user_id, filters)`:
  - lookup user → check department
  - admin ('Administrator IT'): `repo.list_for_reports()` z pełnymi filtrami
  - pracownik: `repo.list_for_user_scope()` (own + managed customers/contracts)

### 7. `api/v1/reports.py` (NOWY)
```
GET /api/v1/reports/activity
Params: current_user_id (UUID, required), period (int 7/30/90/180/365, default 30),
        user_id (UUID, optional — admin only), customer_id (UUID), 
        activity_type (ActivityType), limit (int), offset (int)
Response: ActivityLogReportResponse
```

### 8. `api/v1/__init__.py`
Zarejestrować `reports_router` z prefix="/reports".

### 9. Migracja
`make makemigration` → `make migrate` (dodanie kolumny `department` do tabeli `users`)

---

## Frontend (2 pliki)

### 10. `src/hooks/useActivityLog.ts` (NOWY)
TanStack Query hook. Pobiera `user.id` i `user.department` z Redux.
Wywołuje `GET /api/v1/reports/activity` z filtrami.
Zwraca `{ data, isLoading, isError }`.

### 11. `src/pages/ReportsPage.tsx`
Pełny rewrite: dane z `useActivityLog()`, filtry okresu (7/30/90/180/365d),
KPI cards (events, meetings, documents, notes), timeline log,
wyróżnienie własnych vs team (is_own).
Admin: dodatkowe selecty user_id + activity_type.
Zachowany styl (card, kolory, font).

---

## Ryzyka / decyzje

- `is_own` flag: backend ustawia `performed_by == current_user_id` — pozwala frontendowi wyróżniać wizualnie
- `performed_by_login` z JOIN z users — brak N+1
- Istniejący endpoint `/api/v1/activity-log` (CRM) **pozostaje bez zmian** — testy przechodzą
- `department` nullable → istniejące rekordy User nie crashują; uzupełnianie przy kolejnym logowaniu
- Frontend `AD_PROFILES` zostaje — wyświetlane nazwy to nadal mock (displayName, initials)

## DoD

- [ ] `make check` przechodzi (lint + typecheck + test + security)
- [ ] Stare testy `test_activity_log_api.py` nadal zielone
- [ ] Nowe testy dla `ReportsService` i endpointu
- [ ] `npm run build` przechodzi
- [ ] Migracja zastosowana
