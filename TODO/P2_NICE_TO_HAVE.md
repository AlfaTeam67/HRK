# 🟢 P2 — NICE TO HAVE (jeśli starczy czasu)

---

## T08: Placeholder na TimeSheet / rentowność

**Effort:** 1h | **Assignee:** `(@___)`  
**Branch:** `feat/TODO-08-timesheet-placeholder`

### Kontekst
Firma pytała o integrację z TimeSheet i rentowność. Nie jest w MVP, ale warto pokazać świadomość.

### Subtaski

- [ ] **T08.1** Dodać sekcję "Planowane integracje" w `ReportsPage` lub osobny tab
  - Mockup/wireframe: TimeSheet → import godzin → kalkulacja rentowności per klient
  - Tekst: "W kolejnej iteracji: import danych z systemu TimeSheet, kalkulacja marży per usługa"
- [ ] **T08.2** Dodać diagram architektury integracji w `docs/`
  - Gdzie TimeSheet się wpina (webhook/API → nowa tabela `timesheets` → join z `ContractService`)

---

## T09: Weryfikacja enforcement ról na API

**Effort:** 4h | **Assignee:** `(@___)`  
**Branch:** `feat/TODO-09-role-enforcement`

### Kontekst
Model ról (`UserRole`) i tabel dostępu (`user_company_access`, `user_contract_access`) istnieje, ale trzeba zweryfikować, że API je egzekwuje.

### Subtaski

- [ ] **T09.1** Przejrzeć middleware/dependency auth w `core/auth.py`
  - Czy sprawdza rolę przy operacjach write?
  - Czy viewer nie może edytować stawek/waloryzacji?
- [ ] **T09.2** Dodać testy: viewer próbuje PUT na `/customer-rates/{id}` → 403
- [ ] **T09.3** Dodać testy: account_manager widzi tylko swoich klientów
- [ ] **T09.4** Jeśli brakuje — dodać dependency `require_role(UserRole.ACCOUNT_MANAGER)` na kluczowych endpointach

---

## T10: Eksport raportu waloryzacji

**Effort:** 4-6h | **Assignee:** `(@___)`  
**Branch:** `feat/TODO-10-valorization-export`

### Kontekst
Przycisk "Eksportuj raport" na ValorizationPage jest placeholder. Firma doceni działający eksport.

### Subtaski

- [ ] **T10.1** Backend: endpoint GET `/valorizations/export?format=xlsx`
  - Użyć `openpyxl` do generowania Excel
  - Kolumny: Klient, Nr umowy, Rok, Typ indeksu, Wartość %, Status, Data planowana
- [ ] **T10.2** Frontend: przycisk pobiera plik przez `window.open()` lub axios blob
- [ ] **T10.3** Opcjonalnie: eksport PDF z tabelą (reuse `PdfRenderer`)

---

## T11: Poprawa UX — loading states i error handling

**Effort:** 2-3h | **Assignee:** `(@___)`  
**Branch:** `feat/TODO-11-ux-polish`

### Subtaski

- [ ] **T11.1** Dodać skeleton loaders na głównych stronach (ClientsPage, ContractsPage)
- [ ] **T11.2** Dodać toast notifications przy sukcesie/błędzie operacji CRUD
- [ ] **T11.3** Dodać empty states ("Brak waloryzacji dla tej umowy" zamiast pustej tabeli)
