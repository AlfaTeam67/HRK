# Frontend — strony i feature'y

## Cel

Przewodnik po widokach aplikacji: co robi która strona, z jakich
komponentów się składa, jakie endpointy wywołuje. Dokument ratuje czas
gdy szukasz „gdzie jest formularz X" albo „skąd wziąć logikę Y".

---

## 🔐 `LoginPage` (`/login`)

- Plik: `src/pages/LoginPage.tsx`.
- Logowanie po username (AD).
- Wywołuje `POST /api/v1/auth/login/{username}`.
- Po sukcesie: `dispatch(setUser(...))`, `dispatch(setToken('demo-token'))`,
  redirect na `/`.
- Walidacja: niepuste username; backend rzuca 404 dla nieznanego.

> Token w obecnym MVP to placeholder `'demo-token'`. Docelowo wymieni
> się na JWT albo session cookie z reverse proxy (zob.
> [`../auth/active-directory.md`](../auth/active-directory.md)).

---

## 🏠 `DashboardPage` (`/`)

- Plik: `src/pages/DashboardPage.tsx`.
- Widoczne tylko dla `Specjalista HR` / `Administrator IT`
  (filtr w `<DashboardRedirect>` w `App.tsx`).
- KPI z `GET /api/v1/dashboard/kpi`:
  - `active_customers`
  - `active_contracts`
  - `contracts_expiring_30d`
  - `valorizations_pending`
  - `valorizations_overdue`
- Tabela aktywności / alertów (uproszczona).

---

## 🧑‍💼 `ManagerDashboardPage` (`/managed-dashboard`)

- Plik: `src/pages/ManagerDashboardPage.tsx`.
- Domyślny dashboard dla `Opiekun klienta`.
- Te same KPI co wyżej, ale z `?account_manager_id={user.id}`.
- Lista klientów opiekuna + alerty (otwarte).
- Hook `useAlertWebSockets(clientId)` → live update.

---

## 👥 `ClientsPage` (`/clients`, `/clients/:customerId`)

- Plik: `src/pages/ClientsPage.tsx` (eksport `ClientsPageApi`).
- Lewa kolumna: lista klientów (filtry: `q`, `manager_id`, `statuses`,
  `created_from/to`).
- Prawa kolumna: detal klienta — zakładki:
  - **Informacje** — dane firmy, opiekun, segment, AI summary (SSE stream).
  - **Umowy** — drzewo umów (`ContractTreeList`): macierzyste z
    zagnieżdżonymi aneksami i powiązanymi (SLA/DPA/PPK). Klik → `ContractModal`.
  - **Dokumenty** — `DocumentsTab` z quick filters
    (`Wszystkie | Klient | Umowy | Wymaga akcji`), dropdown typu,
    kolumna „Pochodzenie" (klikalna), akcja „Otwórz umowę →".
  - **Notatki** — `GET /api/v1/notes?customer_id=...`, edycja inline.
  - **Oś czasu** — timeline (`GET .../timeline`).
- Hook'i: `useCustomers`, `useCustomer`, `useCustomerTimeline`,
  `useContracts`, `useDocumentsQuery`, `useContactPersons`, `useCreateNote`, ...
- Komponenty wydzielone:
  - `features/contracts/ContractTreeList.tsx` — drzewo umów.
  - `features/documentGeneration/DocumentsTab.tsx` — zakładka dokumentów.
  - `features/documentGeneration/originHelpers.ts` — helpery `groupContractsByParent`, `buildOrigin`.

Szczegółowy opis zakładek: [`clients-page-tabs.md`](clients-page-tabs.md).

---

## 📑 `ContractsPage` (`/contracts`)

- Plik: `src/pages/ContractsPage.tsx`.
- Tabela umów z filtrami (`statuses`, `customer_id`, daty).
- Otwiera `ContractModal` (z `features/contracts/ContractModal.tsx`)
  do tworzenia / edycji.
- Z poziomu modalu: dodawanie/odczepianie usług
  (`POST /contracts/{id}/services`, `DELETE /contracts/{id}/services/{rid}`).
- Status badge'i: `draft`, `signed`, `active`, `expiring`, `terminated`.

---

## 📈 `ValorizationPage` (`/valorization`)

- Plik: `src/pages/ValorizationPage.tsx`.
- Lista waloryzacji (filtry: `contract_id`, `year`, `status`).
- Akcje: utwórz, edytuj, akceptuj, odrzuć
  (`POST/PATCH /api/v1/valorizations`).
- Hook `useValorizations`, `useCreateValorization`, ...

---

## 🤖 `AdvisorPage` (`/assistant`)

- Plik: `src/pages/AdvisorPage.tsx` — największa strona aplikacji
  (~44 KB).
- **Lewa kolumna**: lista klientów + ich dokumentów (z
  `?exclude_draft=true&include_in_ai_assistant_only=true` — pomija drafty AI
  oraz dokumenty wyłączone przełącznikiem przez opiekuna).
- **Środek**: chat — pytanie wpisane przez użytkownika trafia do
  `POST /api/v1/rag/search` z `customer_id` i `ai_mode` (switch).
- **Prawa kolumna**: PDF preview (`PdfPreviewModal`) z podświetlonym
  fragmentem (`page_number` + `bbox` z chunku).
- Switch **Tryb AI** (off → samo retrieval ~200 ms, on → LLM ~3-10 s).

Zob. [`../ai/rag.md`](../ai/rag.md) dla pełnego pipeline'u.

---

## 📊 `ReportsPage` (`/reports`)

- Plik: `src/pages/ReportsPage.tsx`.
- Raporty operacyjne: lista wygasających umów (30/60/90), lista
  zaległych waloryzacji, wykres trendu.
- Dane: kompozycja `useDashboardKpi` + `useAlerts`.

---

## ⚙️ `SettingsPage` (`/access`)

- Plik: `src/pages/SettingsPage.tsx`.
- Zarządzanie użytkownikami (`/api/v1/users`).
- Mapowanie ról / dostępy (UI założenie pod przyszły moduł permissions).

---

## Feature: `DocumentWizard` (generowanie aneksu)

`src/features/documentGeneration/`:

| Plik              | Co robi |
|-------------------|---------|
| `DocumentWizard.tsx`   | Wieloetapowy kreator (wybór klienta → umowy → szablonu → parametrów) |
| `SimulationPanel.tsx`  | Pokazuje `simulation` (delta margin, per-usługa) |
| `DocumentsTab.tsx`     | Lista wygenerowanych + przyciski Akceptuj/Odrzuć |
| `types.ts`             | Lokalne typy formularza |
| `wizardStyles.ts`      | Wspólne style |

Flow:
1. `GET /document-generations/templates` — wybór szablonu.
2. `POST /document-generations/preview` — render HTML + symulacja
   (bez PDF).
3. `POST /document-generations?generated_by=...` — render PDF z DRAFT,
   upload do S3, zapis rekordu (`status=preview`).
4. `POST /document-generations/{id}/accept` — render czysty PDF,
   stary draft cleanup, status `accepted`.
5. PDF aneksu staje się indeksowany w RAG (`ocr_status=pending` →
   `done`).

Zob. [`../ai/document-generation.md`](../ai/document-generation.md) i
[`../workflows/document-generation.md`](../workflows/document-generation.md).

---

## Feature: `UploadWizard` (upload dokumentu)

`src/features/documents/UploadWizard.tsx`.

Flow:
1. Wybór pliku (`<input type="file">`) — walidacja MIME / rozmiaru
   (10 MB).
2. Wybór typu (`DocumentType`), customer/contract/company.
3. Checkbox **„Załącz dla asystenta AI (zalecane)"** — domyślnie ON.
   Odznaczenie powoduje, że plik trafia do S3 i DB, ale `ocr_status='skipped'`
   i background indeksacja nie startuje. Można włączyć później przełącznikiem
   na karcie dokumentu.
4. `POST /api/v1/documents` (multipart) z `uploaded_by={user.id}` i
   `include_in_ai_assistant=<bool>`.
5. Po sukcesie: invalidate `['documents', ...]`, toast.
6. Background na backendzie: chunking + embedding (zob.
   [`../workflows/document-upload.md`](../workflows/document-upload.md)).

UI dba, by **nie blokować** użytkownika — odpowiedź wraca natychmiast.
Status indeksowania widać w `OcrStatusBadge` + `AiAssistantToggle`
(zob. [`../ai/ai-assistant-toggle.md`](../ai/ai-assistant-toggle.md)).

---

## Feature: `ContractModal`

`src/features/contracts/ContractModal.tsx` (~30 KB).

- Tworzenie / edycja umowy.
- Tabs: **Dane podstawowe**, **Usługi (ContractService)**, **Aneksy**,
  **Załączniki**.
- Walidacja formularza po stronie frontu (daty, numer umowy).
- Po commit: `POST/PATCH /api/v1/contracts`, refresh listy.

---

## Komponenty współdzielone

### `PdfPreviewModal`
- `react-pdf` + `pdfjs-dist` (worker hostowany przez Vite).
- Przyjmuje `presigned URL` (z `/documents/{id}/download-url`) lub
  ścieżkę do streamu (`/documents/{id}/stream`).
- Wspiera podświetlanie po `bbox` z chunka RAG.

### `OcrStatusBadge`
- Mapuje `OcrStatus` na ikonę + kolor:
  - `pending` / `processing` / `null` → 🔄 spinner „indeksowanie..."
  - `done` → ✅
  - `failed` → ⚠️
  - `skipped` → ❌ (zwykle ukryte, dla debugu)

### `HrkLogo`
- SVG firmowe.

---

## Antywzorce

- ❌ Wpinanie logiki domenowej w komponent (np. liczenie waloryzacji
  po stronie FE) — ma to robić backend.
- ❌ Twardy URL `http://localhost:8000` w jsx — `env.apiUrl`.
- ❌ Mutowanie odpowiedzi z Query — wszystko jest immutable.
- ❌ Próba dynamicznej zmiany layoutu (np. własny sidebar per strona) —
  jeden `<AppLayout>`, ewentualnie tabsy wewnątrz strony.
