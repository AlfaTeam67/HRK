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
  - Swoje działania (created_by = current_user)
  - Działania innych na klientach/umowach przypisanych do niego
- KPI z własnych działań + działań na swoich zasobach
- Inne działania wyróżniane (np. inna nazwa użytkownika)

### Filtry dla admina:
- Po użytkowniku
- Po kliencie
- Po typie akcji (zmiana statusu, waloryzacja, eksport itd.)
- Po przedziale czasowym

### UI zmian:
- Czysty KPI + timeline log
- Czytelne wyróżnienie kto = akcja
- Dla zwykłego pracownika: jasne oznaczenie czy to jego akcja czy zespołu

## Implementacja:

### Backend:
1. `GET /api/v1/activity-log` — endpoint z filtrami:
   - `period`: 7, 30, 90, 180, 365 (dni)
   - `user_id` (tylko admin)
   - `customer_id`
   - `action_type` (change, approve, system, note, export, view)
   - `offset`, `limit` (paginacja)

2. Role-based filtering w service:
   - Jeśli admin: ALL
   - Jeśli pracownik: own + resources

3. KPI aggregation:
   - events_count
   - status_changes_count
   - approvals_count
   - exports_count

### Frontend:
1. Hooki: `useActivityLog(filters, period)`
2. Filtry UI: buttony okresu, selecty dla admina
3. Role check: `useAppSelector(s => s.auth.user.department)`
4. Timeline z wyróżnieniami dla działań zespołu

## Zmieniane pliki:
- Backend: `api/activity_log.py` (nowy), `service/activity_log.py` (nowy)
- Frontend: `pages/ReportsPage.tsx` (całkowicie), `hooks/activity.ts` (nowy)
