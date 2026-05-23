# 🔴 P0 — KRYTYCZNE (musi być na prezentacji)

---

## T01: Podłączyć ValorizationPage do API

**Effort:** 2-3 dni | **Assignee:** `(@___)`  
**Branch:** `feat/TODO-01-valorization-page-api`

### Kontekst
ValorizationPage jest jedynym ekranem z hardcoded mock data. Backend (model `Valorization`, API `/valorizations`) jest w pełni gotowy.

### Subtaski

- [ ] **T01.1** Utworzyć hook `useValorisations()` w `frontend/src/hooks/valorizations.ts` (analogicznie do `useContracts`)
  - GET lista waloryzacji z filtrami (status, customer_id, contract_id)
  - Mutacje: create, update (zmiana statusu), delete
- [ ] **T01.2** Utworzyć hook `useCustomerRates()` do pobierania stawek per umowa
- [ ] **T01.3** Zamienić mock `kpis` na dane z API
  - Waloryzacje do zrobienia = count where status=pending
  - Przeterminowane = count where status=pending AND planned_date < today
  - Zaplanowane = count where status=pending AND planned_date >= today
  - Wskaźnik GUS = ostatnia wartość `index_value` where `index_type=GUS_CPI`
- [ ] **T01.4** Zamienić mock `rules` na tabelę z prawdziwych waloryzacji
  - JOIN: Valorization → Contract → Customer
  - Kolumny: nr umowy, klient, index_type, index_value, planned_date, status, last applied
- [ ] **T01.5** Zamienić mock `pipeline` na agregację statusów waloryzacji
  - Grupowanie po `status`: pending / approved / applied / rejected
  - Opcjonalnie: suma wartości stawek per grupa
- [ ] **T01.6** Dodać akcje na wierszach tabeli: "Zatwierdź", "Odrzuć", "Generuj aneks"
  - Zatwierdź → PATCH status=approved
  - Odrzuć → PATCH status=rejected
  - Generuj aneks → otwórz `DocumentWizard` z pre-filled contract_id
- [ ] **T01.7** Testy manualne: utworzyć waloryzację, zmienić status, sprawdzić KPI

---

## T02: Dodać tab "Stawki" w karcie umowy (ContractModal)

**Effort:** 1-2 dni | **Assignee:** `(@___)`  
**Branch:** `feat/TODO-02-contract-rates-tab`

### Kontekst
`ContractModal` wyświetla szczegóły umowy. API do stawek (`/customer-rates`, `/contract-services`) istnieje, ale nie ma UI.

### Subtaski

- [ ] **T02.1** Dodać tab "Stawki" w `ContractModal.tsx`
  - Nowy tab obok istniejących (info, usługi, dokumenty)
- [ ] **T02.2** Wyświetlić tabelę stawek per usługa per rok
  - Kolumny: Usługa | Rok | Cena bazowa | Rabat % | Cena netto
  - Dane z `CustomerRate` + `ContractService` + `Service`
- [ ] **T02.3** Dodać możliwość edycji stawki (inline edit lub modal)
  - PUT `/customer-rates/{id}` z nową ceną/rabatem
- [ ] **T02.4** Wyświetlić historię waloryzacji dla tej umowy
  - Lista `Valorization` where contract_id = current
  - Kolumny: Rok | Typ indeksu | Wartość % | Data planowana | Status
- [ ] **T02.5** Dodać przycisk "Nowa waloryzacja" → formularz tworzenia
  - POST `/valorizations` z contract_id, year, index_type, index_value, planned_date
- [ ] **T02.6** Wizualizacja osi czasu zmian stawek (opcjonalnie)
  - Prosty timeline: rok → cena bazowa → % zmiany

---

## T03: Przygotować demo scenariusz end-to-end

**Effort:** 1 dzień | **Assignee:** `(@___)`  
**Branch:** `feat/TODO-03-demo-seed`

### Kontekst
Firma wprost poprosiła o scenariusz: login → klient → dokument → storage → wektoryzacja → AI → źródło → alert. Pipeline działa, potrzebujemy dobrych danych.

### Subtaski

- [ ] **T03.1** Rozbudować `seed_demo.py` o realistyczne dane
  - Min. 3 klientów z różnymi statusami (active, needs_attention, churn_risk)
  - Min. 5 umów w różnych fazach lifecycle (draft, active, expiring)
  - Min. 3 waloryzacje (pending, approved, applied)
  - Usługi i stawki z realnymi kwotami
- [ ] **T03.2** Przygotować 2-3 dokumenty PDF do uploadu na demo
  - Przykładowa umowa ramowa (1-2 strony)
  - Aneks waloryzacyjny
  - Pismo przewodnie
- [ ] **T03.3** Napisać skrypt/instrukcję demo flow
  - Krok po kroku co klikać na prezentacji
  - Jakie pytania zadać AI (i jakie odpowiedzi oczekiwać)
  - Backup plan jeśli coś nie zadziała
- [ ] **T03.4** Przetestować pełny flow na czystej bazie
  - `make docker-down && make docker-up && make docker-migrate`
  - Seed → upload → poczekać na OCR → RAG query
- [ ] **T03.5** Przygotować "wow moment" dla AI
  - Pytanie, na które AI odpowie z cytatem z dokumentu + numer strony
  - Np. "Jakie są warunki wypowiedzenia umowy z Empik?"
