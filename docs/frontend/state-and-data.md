# Frontend — stan i fetchowanie danych

## Cel

Wyjaśnić, **co trzymamy w Redux**, a **co w TanStack Query**, jak działa
`apiClient` z interceptorami i jaki jest wzorzec hooków per encja.

---

## Trzy źródła stanu

```
┌──────────────────────┐  ┌────────────────────────────┐  ┌────────────────┐
│ Redux Toolkit        │  │ TanStack Query (server)    │  │ Local component │
│ (klient/UI/auth)     │  │  - cache odpowiedzi REST   │  │  state (useState)│
│  - user (AuthUser)   │  │  - retry, refetch, stale   │  │  - formularze   │
│  - token             │  │  - invalidacja per query   │  │  - toggle UI    │
│  persist: localStorage│ │    key                     │  │                  │
└──────────────────────┘  └────────────────────────────┘  └────────────────┘
```

Reguła:
- **Auth** (user info, token) → Redux. Persistowany w `localStorage`.
- **Wszystko, co przychodzi z backendu** → TanStack Query.
- **Stan UI komponentu** (otwarty modal, wpisana wartość pola) →
  `useState` / `useReducer`.

---

## Redux store

```ts
// src/store/store.ts
const AUTH_STORAGE_KEY = 'hrk-auth'

function loadAuthState() {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) return undefined
  const parsed = JSON.parse(raw)
  if (parsed?.token === 'demo-token') return { ...parsed, token: null }
  return parsed
}

export const store = configureStore({
  reducer: { auth: authReducer },
  preloadedState: { auth: loadAuthState() },
})

store.subscribe(() => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(store.getState().auth))
})
```

- Tylko **jeden slice** (`auth`). Reszta domeny żyje w Query cache.
- Persist robimy ręcznie (subskrypcja do store), bez `redux-persist`.
- Token `'demo-token'` z poprzednich wersji jest *ucinany* przy ładowaniu.

### `authSlice`

```ts
interface AuthUser {
  id: string
  login: string
  email: string
  displayName: string
  initials: string
  department: string   // 'Opiekun klienta' | 'Specjalista HR' | 'Administrator IT' | ...
}

interface AuthState {
  user: AuthUser | null
  token: string | null
}

// actions: setUser, setToken, logout
```

### Typed hooks

`src/hooks/store.ts`:
```ts
export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
```

Wszędzie w komponentach:
```tsx
const user = useAppSelector(s => s.auth.user)
const dispatch = useAppDispatch()
dispatch(logout())
```

---

## axios + interceptors

```ts
// src/lib/axios.ts
export const apiClient = axios.create({
  baseURL: env.apiUrl,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
})

export function setupAxiosInterceptors(getToken, onUnauthorized) {
  apiClient.interceptors.request.use((config) => {
    const token = getToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })
  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (axios.isAxiosError(error)) {
        const s = error.response?.status
        if (s === 401 || s === 403) onUnauthorized()
      }
      return Promise.reject(error)
    }
  )
}
```

W `main.tsx` interceptory są wpinane raz, czerpią token bezpośrednio
z `store.getState().auth.token` i wołają `store.dispatch(logout())` przy
401/403.

> **Nigdy** nie twórz drugiego `axios.create()` w komponentach — używamy
> jednego klienta, żeby polityka auth była spójna.

---

## TanStack Query — wzorzec hooka per encja

Plik `src/hooks/customers.ts` (skrót):

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/axios'
import type { components } from '@/types/api'

type CustomerRead   = components['schemas']['CustomerRead']
type CustomerCreate = components['schemas']['CustomerCreate']
type CustomerUpdate = components['schemas']['CustomerUpdate']

export function useCustomers(params: { q?: string; manager_id?: string } = {}) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: () =>
      apiClient.get<CustomerRead[]>('/api/v1/customers', { params }).then(r => r.data),
    staleTime: 30_000,
  })
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ['customer', id],
    enabled: !!id,
    queryFn: () =>
      apiClient.get<CustomerRead>(`/api/v1/customers/${id}`).then(r => r.data),
  })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CustomerCreate) =>
      apiClient.post<CustomerRead>('/api/v1/customers', body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}
```

Konwencje:
- **`queryKey`** zaczyna się od string-tagu encji (`'customers'`, `'customer'`,
  `'contracts'`, …).
- **`useXxx`** dla query, **`useCreateXxx` / `useUpdateXxx` / `useDeleteXxx`**
  dla mutacji.
- `enabled: !!id` — nie wystrzeliwujemy zapytania, gdy parametr nie jest
  jeszcze gotowy.
- Po mutacji **zawsze** `invalidateQueries({ queryKey: [tag] })`. To
  najprostszy sposób na refresh listy.

### Klient Query

`src/lib/queryClient.ts` — minimalna konfiguracja:
```ts
import { QueryClient } from '@tanstack/react-query'
export const queryClient = new QueryClient()
```

---

## SSE / WebSocket

### Stream AI summary
```ts
const es = new EventSource(`${env.apiUrl}/api/v1/customers/${id}/ai-summary/stream`)
es.onmessage = (event) => {
  const payload = JSON.parse(event.data)
  if (payload.token) appendToken(payload.token)
  if (payload.done)  es.close()
}
```

### WebSocket alertów
`src/hooks/useAlertWebSockets.ts` (skrót):
```ts
const ws = new WebSocket(`${env.wsUrl}/api/v1/alerts/ws/${clientId}`)
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  if (msg.type === 'alert') queryClient.invalidateQueries({ queryKey: ['alerts'] })
}
```

Hook jest podpinany na `ManagerDashboardPage`. WebSocket pełni rolę
„powiadom mnie, że dane się zmieniły" — refetch idzie przez Query.

---

## env (`src/lib/env.ts`)

```ts
export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  wsUrl:  import.meta.env.VITE_WS_URL  ?? 'ws://localhost:8000',
}
```

Zmienne `VITE_*` są wczytywane przez Vite z `frontend/.env` (i `.env.example`).
**Nigdy** nie wstawiaj URL-i wprost w komponentach.

---

## Typy z OpenAPI

```bash
npm run types:sync
# = openapi-typescript http://localhost:8000/api/v1/openapi.json -o src/types/api.ts
```

- Backend musi działać na `:8000` (z `DEBUG=true`, żeby był OpenAPI URL).
- Plik `src/types/api.ts` jest **w pełni autogenerowany** — nie edytuj
  ręcznie.
- W kodzie używaj typów przez `components['schemas']['CustomerRead']`.

Zob. [`api-types-sync.md`](api-types-sync.md).

---

## Antywzorce

- ❌ `useEffect(() => { fetch(...) })` zamiast `useQuery` — tracisz cache,
  retry, dedupe.
- ❌ `axios.create()` per hook — używaj `apiClient`.
- ❌ Trzymanie listy klientów w Redux — to server state, ma być w Query.
- ❌ Edycja `src/types/api.ts` ręcznie — uruchom `types:sync`.
- ❌ `dispatch(setUser(...))` po zalogowaniu **bez** `setToken(...)` —
  `<RequireAuth>` patrzy na oba pola.

---

## Dalej

- [`pages-and-features.md`](pages-and-features.md) — opisy konkretnych
  stron i feature'ów.
- [`api-types-sync.md`](api-types-sync.md) — generowanie typów.
- [`overview.md`](overview.md) — wracając do struktury.
