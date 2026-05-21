# Frontend — przegląd

## Cel

Pokazać, **jak ułożony jest frontend** HRK CRM — gdzie szukać stron,
komponentów, hooków, jak działa routing i layout. Plik łączy się z
[`state-and-data.md`](state-and-data.md) (Redux + TanStack Query) oraz
[`api-types-sync.md`](api-types-sync.md) (typy z OpenAPI).

---

## Stack

| Warstwa            | Biblioteka                                        |
|--------------------|---------------------------------------------------|
| UI framework       | **React 19** (StrictMode)                         |
| Język              | TypeScript ~5.9                                   |
| Build tool         | **Vite 8** (`@vitejs/plugin-react`)               |
| CSS                | **Tailwind CSS v4** (`@tailwindcss/vite`)         |
| Komponenty         | **shadcn/ui** (Radix UI primitives)               |
| Variants           | `class-variance-authority` + `clsx` + `tailwind-merge` |
| Routing            | **React Router v7** (`react-router-dom`)          |
| Stan klienta       | **Redux Toolkit** + `react-redux`                 |
| Stan serwera       | **TanStack Query v5** (`@tanstack/react-query`)   |
| HTTP               | **axios**                                         |
| PDF preview        | `react-pdf` + `pdfjs-dist`                        |
| Ikony              | `@hugeicons/react` (+ inline SVG w sidebarze)     |
| Czcionka           | `@fontsource-variable/figtree`                    |
| Liczby             | `decimal.js` (kalkulacje finansowe)               |
| OpenAPI → TS       | `openapi-typescript`                              |

---

## Drzewo katalogów

```
frontend/
├── public/                    # statyki (favicon, icons.svg)
├── src/
│   ├── main.tsx               # entry: Provider + QueryClient + Router
│   ├── App.tsx                # routing + RequireAuth
│   ├── index.css              # globalne style (Tailwind v4)
│   ├── pages/                 # jeden plik = jedna trasa
│   │   ├── DashboardPage.tsx
│   │   ├── ManagerDashboardPage.tsx
│   │   ├── ClientsPage.tsx
│   │   ├── ContractsPage.tsx
│   │   ├── ValorizationPage.tsx
│   │   ├── AdvisorPage.tsx           ← AI assistant (RAG)
│   │   ├── ReportsPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── LoginPage.tsx
│   ├── features/              # feature slices (większe domeny)
│   │   ├── auth/
│   │   ├── contracts/         # ContractModal
│   │   ├── documents/         # UploadWizard
│   │   └── documentGeneration/  # DocumentWizard, SimulationPanel, DocumentsTab
│   ├── components/
│   │   ├── HrkLogo.tsx
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx          ← shell (sidebar + Outlet)
│   │   │   └── AppSidebar.tsx
│   │   └── ui/                # shadcn/ui (button, card, badge, modal, ...)
│   ├── hooks/                 # TanStack Query hooks per encja
│   │   ├── customers.ts, contracts.ts, valorizations.ts
│   │   ├── notes.ts, activities.ts, timeline.ts
│   │   ├── documents.ts, documentGenerations.ts
│   │   ├── alerts.ts, useAlertWebSockets.ts
│   │   ├── rag.ts
│   │   ├── auth.ts, contactPersons.ts, companies.ts
│   │   └── store.ts           ← typed dispatch / selector
│   ├── store/
│   │   ├── store.ts           ← configureStore + persist do localStorage
│   │   └── slices/authSlice.ts
│   ├── lib/
│   │   ├── axios.ts           ← apiClient + interceptors
│   │   ├── env.ts             ← VITE_* envs (typed)
│   │   ├── queryClient.ts     ← TanStack Query client
│   │   ├── utils.ts           ← cn() helper
│   │   ├── styles.ts          ← reusable inline-style chunks
│   │   └── customerConstants.ts
│   ├── types/
│   │   ├── api.ts             ← AUTOGEN — z OpenAPI (npm run types:sync)
│   │   ├── models.ts          ← ręczne nadbudowy / aliasy
│   │   └── global.d.ts
│   ├── data/                  # fixture'y / dane testowe
│   └── assets/                # logo, hero
├── package.json
├── vite.config.ts             # alias @/ → src/
├── tsconfig.app.json
└── eslint.config.js
```

> Alias **`@/`** zawsze rozwija się do `frontend/src/`. Używamy go
> wszędzie zamiast `../../../`. Zob. `vite.config.ts` i `tsconfig.app.json`.

---

## Entry point — `main.tsx`

```tsx
setupAxiosInterceptors(
  () => store.getState().auth.token,
  () => store.dispatch(logout())
)

createRoot(rootElement).render(
  <StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  </StrictMode>
)
```

- **Kolejność providerów:** Redux ⊃ Query ⊃ Router. Dzięki temu
  komponenty mają dostęp do wszystkich w tej kolejności.
- Interceptory axiosa są wpinane **raz**, po stworzeniu store'a, przed
  renderowaniem.

---

## Routing — `App.tsx`

```tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />

  <Route element={<RequireAuth />}>
    <Route element={<AppLayout />}>
      <Route index                element={<DashboardRedirect />} />
      <Route path="managed-dashboard" element={<ManagerDashboardPage />} />
      <Route path="clients"        element={<ClientsPageApi />} />
      <Route path="clients/:customerId" element={<ClientsPageApi />} />
      <Route path="contracts"      element={<ContractsPage />} />
      <Route path="valorization"   element={<ValorizationPage />} />
      <Route path="assistant"      element={<AdvisorPage />} />
      <Route path="access"         element={<SettingsPage />} />
      <Route path="reports"        element={<ReportsPage />} />
    </Route>
  </Route>

  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

### `RequireAuth`
Sprawdza `state.auth.user` i `state.auth.token` w Redux. Brak → `Navigate
to="/login"`.

### `DashboardRedirect`
Routing zależny od profilu użytkownika:
- `user.department === 'Opiekun klienta'` → `Navigate to="/managed-dashboard"`
- inni → `<DashboardPage />`

### `AppLayout`
Cały panel zalogowanego użytkownika ma layout `<AppSidebar>` (lewa kolumna)
+ `<Outlet>` (treść strony):

```tsx
export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <main className="flex-1 p-6 overflow-auto flex flex-col min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

### `AppSidebar`
Lewa kolumna 220 px, ciemne tło, sekcje:

- **Główne** — Pulpit / Mój pulpit / Klienci / Umowy / Waloryzacja
- **Asystent AI** — `/assistant`
- **Administracja** — Dostępy / Raporty
- Dół: avatar użytkownika + przycisk wylogowania (`dispatch(logout())`).

Filtrowanie pozycji per `user.department`:
- `/` widoczne dla `Specjalista HR` i `Administrator IT`.
- `/managed-dashboard` widoczne dla `Opiekun klienta`.
- Reszta zawsze.

---

## Komponenty UI

### shadcn/ui w `components/ui/`
Tylko niezbędne primitives:
- `button.tsx` — warianty z `class-variance-authority`
- `input.tsx`, `textarea.tsx`, `label.tsx`
- `card.tsx`, `badge.tsx`
- `modal.tsx` (Radix Dialog) — bazowy
- `PdfPreviewModal.tsx` — wrapper na `react-pdf`
- `OcrStatusBadge.tsx` — wizualizacja statusu indeksowania

### `cn()` helper
```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Standard używania: `<button className={cn("px-4", isActive && "bg-orange-500")}>`.

---

## Strony

Każda strona to **plik per trasa**, ale duże feature'y są wydzielone do
`features/` (np. `DocumentWizard`, `ContractModal`).

| Strona                  | Co robi |
|-------------------------|---------|
| `LoginPage`             | Login przez `/api/v1/auth/login/{username}` |
| `DashboardPage`         | KPI + ostatnie alerty (dla HR / IT) |
| `ManagerDashboardPage`  | „Mój pulpit" — alerty filtrowane per opiekun |
| `ClientsPage`           | Lista + wyszukiwarka + szczegóły klienta (tabbed) |
| `ContractsPage`         | Tabela umów + `ContractModal` |
| `ValorizationPage`      | Lista waloryzacji + akceptacja / odrzucenie |
| `AdvisorPage`           | Chat z asystentem (RAG search per klient) |
| `ReportsPage`           | Raporty operacyjne |
| `SettingsPage`          | Ustawienia / dostępy / role |

---

## Czego nie ma (świadomie)

- ❌ Brak SSR / Next.js — to klasyczny SPA.
- ❌ Brak GraphQL — REST + TanStack Query wystarczy.
- ❌ Brak własnego cache w localStorage poza Redux'em (auth).
- ❌ Brak ikon Material/FontAwesome — używamy `@hugeicons/react` lub
  inline SVG w sidebarze.

---

## Dalej

- [`state-and-data.md`](state-and-data.md) — Redux + TanStack Query, hooki, axios.
- [`pages-and-features.md`](pages-and-features.md) — opisy stron i feature'ów.
- [`api-types-sync.md`](api-types-sync.md) — generowanie typów z OpenAPI.
