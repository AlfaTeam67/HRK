# Frontend — synchronizacja typów API

## Cel

Wyjaśnić, **dlaczego** typy API są autogenerowane i **jak** je odświeżyć.

---

## Dlaczego autogenerate?

- Backend (FastAPI) sam generuje **OpenAPI 3.1** z modeli Pydantic.
- Trzymanie tych samych typów ręcznie po stronie FE = źródło bugów.
- `openapi-typescript` zamienia `openapi.json` na czysty `.d.ts`-like
  plik bez runtime'u — zero kosztu w bundle.

Single source of truth = backend.

---

## Komenda

```bash
cd frontend
npm run types:sync
```

Pod spodem:
```bash
openapi-typescript http://localhost:8000/api/v1/openapi.json -o src/types/api.ts
```

> Backend musi działać na `:8000` z `DEBUG=true` (inaczej `openapi.json`
> nie jest eksportowany).

---

## Wynik

`frontend/src/types/api.ts` (~93 KB) z dwoma głównymi eksportami:

```ts
export interface paths { /* mapa path → operacja → request/response */ }
export interface components { /* schematy: schemas, parameters, responses */ }
```

W kodzie używamy `components['schemas'][NAME]`:

```ts
import type { components } from '@/types/api'

type CustomerRead = components['schemas']['CustomerRead']
type ContractStatus = components['schemas']['ContractStatus']
```

---

## Kiedy uruchomić `types:sync`

Zawsze gdy:
- ✅ Zmieniłeś schemat Pydantic w `backend/src/app/schemas/*.py`.
- ✅ Dodałeś nowy endpoint.
- ✅ Zmieniłeś enum (`backend/src/app/models/enums.py`).
- ✅ Po pull-u zmian od kolegi, jeśli widzisz błędy TS w `api.ts`.

---

## Co NIE robić

- ❌ Nie edytuj `src/types/api.ts` ręcznie. Twoje zmiany znikną przy
  kolejnym `types:sync`.
- ❌ Nie commituj wersji `api.ts` niezgodnej z aktualnym backendem.
  Pre-commit hook? Mile widziany, jeszcze nie ma.
- ❌ Nie używaj „nakładkowych" typów do override'owania backendu — jeśli
  pole nie pasuje, popraw backend.

---

## Niestandardowe rozszerzenia typów

Jeśli **musisz** mieć typ, którego nie ma w API (np. local UI state),
dodaj go do `src/types/models.ts`:

```ts
import type { components } from './api'

export type CustomerListItem = Pick<
  components['schemas']['CustomerRead'],
  'id' | 'ckk' | 'status' | 'company_id'
> & {
  // local UI flag, nie istnieje w API
  __isExpanded?: boolean
}
```

To jest **świadoma** lokalna nadbudowa — nie ingerujesz w autogen.

---

## Diagnostyka

| Symptom | Co zrobić |
|---|---|
| `connect ECONNREFUSED 127.0.0.1:8000` | Uruchom backend (`make run` lub `make docker-up`). |
| `404 /api/v1/openapi.json` | W `.env` ustaw `DEBUG=true` w backendzie. |
| Świeży `api.ts`, ale TS lints krzyczą | `npm run types:sync` → restart TS server w IDE. |
| Typ nie istnieje w `components['schemas']` | Sprawdź, czy schemat jest faktycznie używany przez jakiś endpoint (FastAPI eksportuje tylko schematy „przylepione" do response/body). |
