# Przepływ żądania (request flow)

## Cel

Pokazać krok po kroku, co się dzieje od kliknięcia w UI do zwrócenia odpowiedzi
i odświeżenia widoku. Ten dokument jest punktem odniesienia, gdy debugujesz
„dlaczego endpoint nie działa" albo wprowadzasz nową funkcjonalność.

---

## Warstwy

```
┌────────────────────────────────────────────────────────────────────────┐
│  Component (React) ──► Hook (useQuery / useMutation) ──► axios ──► API│   FRONTEND
└────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP /api/v1/...
┌────────────────────────────────────────────────────────────────────────┐
│  FastAPI Router ──► Dep(get_db / get_*_service) ──► Pydantic schema   │
│           │                                                            │
│           ▼                                                            │
│        Service (logika biznesowa, walidacje, orkiestracja)            │
│           │                                                            │
│           ▼                                                            │
│        Repository (zapytania SQLAlchemy, brak logiki domenowej)        │
│           │                                                            │
│           ▼                                                            │
│        AsyncSession ──► PostgreSQL                                     │   BACKEND
└────────────────────────────────────────────────────────────────────────┘
```

**Zasada żelazna:**
- API nigdy nie woła SQLAlchemy bezpośrednio — tylko przez Service.
- Service nigdy nie woła SQLAlchemy bezpośrednio — tylko przez Repo.
- Repo nigdy nie zwraca surowych dictów Pydantic — zwraca obiekty ORM lub
  prostą reprezentację, którą Service zamienia na schemat odpowiedzi.

(Wyjątek: niektóre serwisy AI/aggregations czytają wprost przez `select(...)`
gdy zapytanie jest bardzo specyficzne i nie ma sensu duplikować w repo —
ale to świadoma decyzja, nie reguła.)

---

## Frontend → backend

### Krok 1. Komponent React odpala hook

```tsx
// src/pages/ClientsPage.tsx
const { data, isLoading } = useCustomers({ q: search })
```

### Krok 2. Hook deklaruje query (TanStack Query)

```ts
// src/hooks/customers.ts
export function useCustomers(filters: CustomerFilters) {
  return useQuery({
    queryKey: ['customers', filters],
    queryFn: () => apiClient.get<components['schemas']['CustomerRead'][]>(
      '/api/v1/customers',
      { params: filters }
    ).then(r => r.data),
    staleTime: 30_000,
  })
}
```

- `queryKey` — identyfikator cache (tablica). Mutacje invalidują przez ten klucz.
- `staleTime` — okres, w którym dane są uznawane za świeże (brak refetchu).
- Błędy łapie globalny error boundary albo ad-hoc `error` z hooka.

### Krok 3. axios + interceptor

```ts
// src/lib/axios.ts
apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
apiClient.interceptors.response.use(undefined, (err) => {
  if (err.response?.status === 401 || 403) onUnauthorized()  // dispatch(logout())
  return Promise.reject(err)
})
```

- Wszystkie żądania idą przez **jedną instancję** `apiClient`.
- Token bierze się z Reduxa (`store.getState().auth.token`).
- 401/403 ⇒ wylogowanie (przekierowanie do `/login`).

---

## Backend — od routera do bazy

Przykład: `GET /api/v1/customers` (CRM legacy router, `app/api/customers.py`).

### Krok 1. FastAPI dispatch

```python
@router.get("/customers", response_model=list[CustomerRead])
async def list_customers(
    service: Annotated[CRMService, Depends(get_crm_service)],
    q: str | None = Query(default=None),
    statuses: list[CustomerStatus] | None = Query(default=None),
    ...
) -> Any:
    return await service.list_customers(q=q, statuses=...)
```

- `Depends(get_crm_service)` tworzy serwis z bieżącą `AsyncSession` (factory w
  `app/api/deps.py`).
- Argumenty zapytania są walidowane przez FastAPI / Pydantic (typy).
- `response_model` wymusza serializację — pola, których nie ma w `CustomerRead`,
  są odcinane.

### Krok 2. Service — logika domenowa

```python
# app/service/facade.py (CRMService — facade nad mniejszymi serwisami)
async def list_customers(self, *, q, statuses, ...) -> list[Customer]:
    return await self._customers.list_customers(q=q, statuses=statuses, ...)
```

- Service jest **świadomy domeny**: wie, że klient z `deleted_at != NULL` to
  klient skasowany, że alert „brak kontaktu" to >90 dni od ostatniej aktywności,
  że waloryzacja `pending` po `planned_date` to alert „overdue" itd.
- Service **może** wołać kilka repozytoriów, robić agregacje, decydować o
  flagach typu „czy generujemy AI summary z cache".

### Krok 3. Repository — surowe zapytania

```python
# app/repo/customers.py
class CustomersRepo:
    async def list_customers(self, *, q, statuses, ...):
        stmt = select(Customer).where(Customer.deleted_at.is_(None))
        if q:
            stmt = stmt.where(Customer.ckk.ilike(f"%{q}%"))
        if statuses:
            stmt = stmt.where(Customer.status.in_(statuses))
        return (await self._session.execute(stmt)).scalars().all()
```

- Repo zna SQLAlchemy. Nie zna FastAPI ani Pydantic.
- Bazowe operacje (`get`, `create`, `update`, `delete`, `count`, `get_multi`)
  są w `app/repo/base.py` i dziedziczone przez konkretne repozytoria.

### Krok 4. AsyncSession + commit

- Sesja przychodzi przez DI (`get_db` → `AsyncSessionLocal()`).
- Endpointy mutujące **same wołają** `await db.commit()` (CRM legacy router)
  albo robi to wewnątrz serwisu (np. `DocumentService.upload_document`).
- Wzorzec rollback przy `IntegrityError`:
  ```python
  try:
      ...
      await db.commit()
  except IntegrityError:
      await db.rollback()
      raise HTTPException(400, detail="...") from None
  ```

### Krok 5. Serializacja przez `response_model`

FastAPI uruchamia `CustomerRead.model_validate(orm_obj)` (Pydantic v2 + ORM mode).
Klient dostaje JSON.

---

## BackgroundTasks — fire-and-forget

Niektóre operacje (upload dokumentu, akceptacja generacji) wracają natychmiast,
a ciężka praca leci „w tle":

```python
@router.post("/", response_model=DocumentRead, status_code=201)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    ...
):
    return await service.upload_document(
        file=file,
        ...,
        background_tasks=background_tasks,
    )

# wewnątrz serwisu, po commit:
background_tasks.add_task(
    DocumentProcessingService().process,
    attachment.id, attachment.customer_id, content, content_type,
)
```

- Background task tworzy **własną** sesję DB (`AsyncSessionLocal()`),
  nie używa request-scope-d session (tej już może nie być).
- Brak retry / kolejki — to jest świadomy MVP-tradeoff (zob.
  [`../workflows/document-upload.md`](../workflows/document-upload.md)).

---

## WebSocket — alerty live

```python
# app/api/v1/alerts.py
@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str) -> None:
    await manager.connect(websocket)
    try:
        await manager.send_personal_message(
            {"type": "connection_established", "client_id": client_id}, websocket
        )
        while True:
            data = await websocket.receive_text()
            await manager.send_personal_message({"echo": data}, websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
```

Frontendowy hook `useAlertWebSockets` łączy się i nasłuchuje na pushe
nowych alertów. Manager (`app.core.websockets.manager`) jest singletonem
trzymającym aktywne połączenia.

---

## SSE — streaming AI summary

```python
@router.get("/{customer_id}/ai-summary/stream")
async def stream_ai_summary(...) -> StreamingResponse:
    return StreamingResponse(
        service.stream(customer_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

Service yielduje `data: {"token": "..."}\n\n`. Frontend czyta `EventSource`
i dopisuje tokeny do widoku w czasie rzeczywistym.

---

## Diagram obecnej zgodności warstw

| Warstwa     | Co wie? | Co woła?                  |
|-------------|---------|---------------------------|
| Component   | UI      | Hook (useQuery / useMutation) |
| Hook        | API endpoint, klucze cache | axios |
| axios       | Bearer token, base URL | FastAPI HTTP |
| Router      | HTTP → schemat / serwis | Service przez `Depends` |
| Service     | reguły domenowe | Repo, inne Service, klienci HTTP (AI/AD) |
| Repo        | SQLAlchemy | AsyncSession |
| Session     | transakcja  | asyncpg → PostgreSQL |

Im wyżej w tej tabeli, tym mniej technicznych szczegółów. Każda warstwa
**chowa** szczegóły tej niżej.

---

## Najczęstsze błędy / antywzorce

- ❌ Wołanie `select(...)` w API routerze → przenieś do Service / Repo.
- ❌ Zwracanie obiektów ORM bezpośrednio przez sieć (tylko przez `response_model`).
- ❌ `db.commit()` w Repo — to odpowiedzialność API/Service.
- ❌ `axios.create()` w komponencie — używaj globalnego `apiClient`.
- ❌ Twardy URL `http://localhost:8000` w komponencie — używaj `env.apiUrl`.
- ❌ `useQuery` bez `queryKey` lub z dynamicznym, ale niezdeterministycznym kluczem.

---

## Dalej

- [`../backend/structure.md`](../backend/structure.md) — układ kodu backendu.
- [`../backend/api-reference.md`](../backend/api-reference.md) — pełny katalog endpointów.
- [`../frontend/state-and-data.md`](../frontend/state-and-data.md) — Redux + TanStack Query.
