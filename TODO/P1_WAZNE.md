# 🟡 P1 — WAŻNE (mocno podnosi ocenę)

---

## T04: Confidence score na UI asystenta AI

**Effort:** 2-4h | **Assignee:** `(@___)`  
**Branch:** `feat/TODO-04-confidence-score-ui`

### Kontekst
Backend zwraca `similarity` (0-1) i `score` (reranker) w `ChunkResult`. Firma chce widzieć jawny wskaźnik zaufania przy odpowiedziach AI.

### Subtaski

- [ ] **T04.1** Dodać badge "Pewność: X%" przy każdym fragmencie źródłowym w `AdvisorPage`
  - `similarity * 100` zaokrąglone do int
  - Kolor: ≥80% zielony, 60-79% żółty, <60% czerwony
- [ ] **T04.2** Dodać średnią pewność dla całej odpowiedzi AI
  - Średnia `similarity` z top-K chunków użytych do generacji
  - Wyświetlić pod odpowiedzią: "Odpowiedź oparta na X źródłach (śr. pewność: Y%)"
- [ ] **T04.3** Jeśli brak wyników lub niska pewność (<40%) — wyświetlić ostrzeżenie
  - "⚠️ Niska pewność odpowiedzi — zweryfikuj z dokumentem źródłowym"

---

## T05: Dokumentacja wymagań sprzętowych AI

**Effort:** 1-2h | **Assignee:** `(@___)`  
**Branch:** `feat/TODO-05-ai-hardware-docs`

### Kontekst
Firma pyta o wymagania sprzętowe dla lokalnego modelu. Trzeba to udokumentować.

### Subtaski

- [ ] **T05.1** Utworzyć `docs/ai-hardware-requirements.md`
  - Minimalne: 16GB RAM, 4-core CPU, SSD
  - Rekomendowane: 32GB RAM, GPU NVIDIA 8GB+ VRAM (RTX 3060+)
  - Modele: `nomic-embed-text` (embedding, ~300MB), `gemma-3-4b` (LLM, ~3GB)
  - Ollama: wersja, instalacja, konfiguracja
  - Czas odpowiedzi: embedding ~100ms, LLM ~2-5s (CPU) / ~0.5-1s (GPU)
- [ ] **T05.2** Dodać sekcję w głównym README z linkiem do tego dokumentu
- [ ] **T05.3** Dodać info o trybie fallback (OpenRouter) gdy brak lokalnego GPU

---

## T06: Usunąć mock data z DashboardPage

**Effort:** 2-4h | **Assignee:** `(@___)`  
**Branch:** `feat/TODO-06-dashboard-real-data`

### Kontekst
`DashboardPage` ma mock `smartPulse` i `activity`. Alerty już są z API, ale reszta jest hardcoded.

### Subtaski

- [ ] **T06.1** Zamienić mock `smartPulse` na dane z API
  - Opcja A: użyć `CustomerRelationScore` (model istnieje)
  - Opcja B: wyliczać na froncie z customer.status
- [ ] **T06.2** Zamienić mock `activity` na dane z `ActivityLog` API
  - GET `/activities?limit=10&sort=-created_at`
  - Wyświetlić: klient, typ aktywności, data, opis
- [ ] **T06.3** Upewnić się, że KPI na dashboardzie są z API (już częściowo podłączone)

---

## T07: Oś czasu waloryzacji na karcie umowy

**Effort:** 4-6h | **Assignee:** `(@___)`  
**Branch:** `feat/TODO-07-valorization-timeline`

### Kontekst
Firma chce widzieć historię zmian stawek w czasie. Dane istnieją w `Valorization` + `CustomerRate`.

### Subtaski

- [ ] **T07.1** Dodać endpoint GET `/contracts/{id}/valorization-history`
  - Zwraca listę: rok, index_type, index_value, status, applied_date, stawki przed/po
- [ ] **T07.2** Dodać komponent `ValorizationTimeline` na froncie
  - Pionowa oś czasu z punktami per rok
  - Każdy punkt: rok, % zmiany, status (badge), data zastosowania
- [ ] **T07.3** Osadzić w tab "Stawki" w `ContractModal` (pod tabelą stawek)
