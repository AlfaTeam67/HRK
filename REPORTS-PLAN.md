# Plan: Raporty — rzeczywiste dane + role-based filtering

## Decyzje z Q&A:

### Dane:
- KPI liczone z `ActivityLog` (nie mockowane)
- Filtry czasowe: 7 dni, 30 dni, 90 dni, pół roku, rok
- Default: 30 dni

### Dostęp na rolach:
**Admin** (department='Administrator IT'):
- Widzi ALL działania w systemie
- KPI z całego systemu

**Zwykły pracownik** (department='Opiekun klienta' lub 'Specjalista HR'):
- Widzi:
  - Swoje działania (performed_by = current_user.id)
  - Działania innych na klientach przypisanych do niego (customer.account_manager_id = current_user.id)
- KPI z własnych działań + działań na swoich zasobach
- Inne działania wyróżniane (np. inna nazwa użytkownika)

### Filtry dla admina:
- Po użytkowniku
- Po kliencie
- Po typie akcji (istniejący ActivityType: meeting, email, note, document, verification, call, system)
- Po przedziale czasowym

### UI zmian:
- Czysty KPI + timeline log
- Czytelne wyróżnienie kto = akcja
- Dla zwykłego pracownika: jasne oznaczenie czy to jego akcja czy zespołu

---

## Decyzje techniczne (po Q&A):

### Rola usera:
- Dodać `department: str` do modelu `User` (migracja DB)
- Uzupełniać przy logowaniu z AD — z `ADUserRead.groups` (pierwsza grupa = department)
- Frontend sprawdza `auth.user.department` z Redux store

### ActivityType enum:
- Zostaje istniejący: `meeting, email, note, document, verification, call, system`
- KPI aggregation mapuje grupy:
  - `events_count` — wszystkie
  - `meetings_count` — meeting + call
  - `documents_count` — document
  - `notes_count` — note + email

### Auth na endpoincie:
- Bez JWT/session — kompatybilne z obecnym AD flow
- Frontend wysy­ła `current_user_id` (UUID z Redux store) jako query param
- Backend robi lookup `User` po tym UUID, czyta `department` → role check

---

## Implementacja:

### Backend (nowe/zmienione pliki):

1. **`models/user.py`** — dodać `department: str | None` (nullable żeby nie łamać istniejących rekordów)

2. **`service/ad_login.py`** — przy tworzeniu usera: `department = ad_user.groups[0] if ad_user.groups else None`
   - Przy ponownym logowaniu (existing_user): aktualizować department z AD

3. **`repo/activity.py`** — nowe metody:
   - `list_filtered(filters, period_days, limit, offset)` — wszystkie dla admina
   - `list_for_user(user_id, customer_ids, filters, period_days, limit, offset)` — dla pracownika
   - `get_kpi(scope_filter, period_days)` — zwraca dict z KPI

4. **`api/v1/activity_log.py`** (NOWY plik w v1/) — endpoint:
   ```
   GET /api/v1/reports/activity
   ```
   Params: `current_user_id`, `period` (7/30/90/180/365, default 30),
           `user_id` (admin only), `customer_id`, `activity_type`, `limit`, `offset`

5. **`service/activity_log.py`** (NOWY) — logika:
   - Pobiera usera po `current_user_id`
   - Sprawdza `user.department`
   - Admin → `repo.list_filtered()`
   - Pracownik → pobiera jego `customer_ids` z `CustomerRepository`, wywołuje `repo.list_for_user()`

6. **`schemas/activity.py`** — dodać `ActivityLogListResponse`:
   - `items: list[ActivityLogRead]`
   - `kpi: ActivityKPI`
   - `total: int`

7. **`main.py`** — zarejestrować nowy router

### Frontend (nowe/zmienione pliki):

1. **`pages/ReportsPage.tsx`** — całkowity rewrite:
   - Filtry okresu (przyciski 7/30/90/180/365)
   - Admin: selecty user_id + customer_id + activity_type
   - KPI cards (events, meetings, documents, notes)
   - Timeline log z wyróżnieniem: własne vs zespołu

2. **`hooks/useActivityLog.ts`** (NOWY w `src/hooks/`):
   - TanStack Query hook: `useActivityLog(filters, period)`
   - Pobiera `current_user_id` z Redux: `useAppSelector(s => s.auth.user.id)`

3. **`schemas/user.ts`** — po `npm run types:sync` department pojawi się automatycznie

### Kolejność implementacji:
1. Model + migracja (department na User)
2. Aktualizacja ADLoginService
3. Repo methods
4. Service + API endpoint
5. Schemas
6. Frontend hook + ReportsPage
7. types:sync

## Zmieniane pliki:
- Backend: `models/user.py`, `service/ad_login.py`, `repo/activity.py`, `api/v1/activity_log.py` (nowy), `service/activity_log.py` (nowy), `schemas/activity.py`, `main.py`
- Frontend: `pages/ReportsPage.tsx`, `hooks/useActivityLog.ts` (nowy)
