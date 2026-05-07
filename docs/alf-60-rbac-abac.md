# ALF-60 — RBAC + ABAC w HRK CRM

> Status: **DONE** (po niniejszym dopięciu). Dokument streszcza model uprawnień, mapowanie ról na akcje, sposób egzekwowania w warstwie API + service oraz instrukcje dla devów / QA / Postman.

## 1. Cel zadania

Zgodnie z opisem ticketu w Linear (ALF-60):

- zdefiniować **policy matrix**: `rola → akcja → zasób → warunek`,
- reguły dostępu **per `company_id`** oraz **per umowa/kontrakt**,
- centralny mechanizm autoryzacji w FastAPI,
- spójna egzekucja na endpointach CRUD i AI,
- czytelna odmowa (`403` + ustrukturyzowany kod błędu),
- testy negatywne i pozytywne dla kluczowych ról.

---

## 2. Wysokopoziomowy obraz

```
┌────────────┐     login           ┌──────────────────────┐
│  Klient    ├────────────────────▶│ POST /auth/login/{u} │  (jedyny endpoint
│ (Postman / │                     │  zwraca User po LDAP │   bez bearer auth)
│  Frontend) │◀────────────────────┤                      │
└─────┬──────┘   User { id, login} └──────────────────────┘
      │
      │  Authorization: Bearer <login>            (MVP: token = login)
      ▼
┌────────────────┐    Depends(get_current_user)    ┌────────────────────┐
│  FastAPI       ├────────────────────────────────▶│ AuthorizationService│
│  router        │   AuthorizationService.         │ - get_user_roles    │
│  / Service     │   authorize_by_policy(...)      │ - admin bypass      │
│  facade        │                                 │ - _has_scope        │
└────────────────┘                                 │ - min role check    │
                                                   └─────────┬───────────┘
                                                             │
                                                ┌────────────┴───────────┐
                                                ▼                        ▼
                                       user_roles                 user_company_access
                                       (RBAC)                     user_contract_access
                                                                  (ABAC scope)
```

- **Identity** pochodzi z Active Directory (`ADLoginService`). DB trzyma tylko (`id`, `login`, `email`).
- **Authorization** jest lokalna w CRM:
  - **RBAC** — kto może (`user_roles`),
  - **ABAC** — gdzie może (`user_company_access`, `user_contract_access`).

Te dwie warstwy są celowo rozdzielone: AD nie wie nic o firmach klienckich, CRM nie chce być źródłem prawdy o tożsamości.

---

## 3. Model danych

| Tabela                 | Klucz                                | Sens                                                             |
| ---------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| `users`                | `id (uuid)`                          | Tożsamość: `login`, `email`. Brak hasła, brak roli w tej tabeli. |
| `user_roles`           | (`user_id`, `role`) — PK kompozytowy | M2M. Użytkownik może mieć **wiele ról** jednocześnie.            |
| `user_company_access`  | (`user_id`, `company_id`) — PK       | ABAC: użytkownik widzi/modyfikuje zasoby danej firmy.            |
| `user_contract_access` | (`user_id`, `contract_id`) — PK      | ABAC: dostęp wąski do pojedynczej umowy (ortogonalnie do firmy). |

Migracja: [`backend/alembic/versions/2d4e6f8a9b0c_add_user_roles_and_contract_scope.py`](../backend/alembic/versions/2d4e6f8a9b0c_add_user_roles_and_contract_scope.py).

> Migracja `0a1b2c3d4e5f` jest świadomym **no-op**em — pełni rolę markera kolejności i zachowuje kompatybilność wcześniejszych branchy. Nie usuwamy jej, by nie psuć drzewa rewizji.

### Reguła nieprzypisanej roli

Jeśli użytkownik nie ma żadnego rekordu w `user_roles`, `AuthorizationService.get_user_roles()` zwraca `{VIEWER}`. To **świadoma decyzja**: każdy zalogowany user ma minimum read-only nawet bez explicite przypisanej roli (pozwala to nowemu pracownikowi widzieć pulpit zanim admin nada mu właściwą rolę).

### Reguła scope’u (ABAC)

`_has_scope(user, company_id, contract_id)` zwraca `True` jeżeli **ZACHODZI cokolwiek z**:

- istnieje wpis `(user_id, company_id)` w `user_company_access`,
- istnieje wpis `(user_id, contract_id)` w `user_contract_access`.

Czyli logika **OR**. Wystarczy jeden ze scope’ów. Admin bypass jest sprawdzany wcześniej i pomija scope w ogóle.

---

## 4. Role i hierarchia

```
admin (4)  ─────  pełny dostęp; bypass scope; jedyna rola która może zarządzać
                  ról i scope’ów (`/api/v1/access/*`, `/api/v1/users/*`).

manager (3) ─── ┐ równorzędne; mogą tworzyć/edytować/usuwać w obrębie scope
account_manager (3) ─┘  swoich firm/umów.

consultant (2)  ─ tworzy customers/contracts/notes/contact_persons w scope;
                  nie może update/delete (to dla MANAGER+).

viewer (1)     ─ read-only w obrębie scope.
```

Ranking jest zaszyty w `AuthorizationService._ROLE_RANK`. Sprawdzenie roli w policy matrix robi to **przez ranking**, nie przez równość — czyli kto ma `manager` automatycznie spełnia każdą politykę wymagającą `consultant` lub `viewer`.

---

## 5. Policy matrix

Źródło prawdy: `AuthorizationService.POLICY_MATRIX` ([`backend/src/app/core/auth.py`](../backend/src/app/core/auth.py)).

| Zasób            | read   | list   | create     | update     | delete  | inne                       |
| ---------------- | ------ | ------ | ---------- | ---------- | ------- | -------------------------- |
| `company`        | viewer | viewer | **admin**  | manager    | manager | —                          |
| `customer`       | viewer | viewer | consultant | manager    | manager | —                          |
| `contract`       | viewer | viewer | consultant | manager    | manager | —                          |
| `service`        | viewer | viewer | manager    | manager    | manager | —                          |
| `rate`           | viewer | viewer | consultant | manager    | manager | —                          |
| `valorization`   | viewer | viewer | manager    | manager    | manager | —                          |
| `document`       | viewer | —      | —          | —          | manager | `upload`: consultant       |
| `note`           | viewer | viewer | consultant | consultant | manager | —                          |
| `contact_person` | viewer | viewer | consultant | consultant | manager | —                          |
| `activity`       | viewer | viewer | consultant | —          | —       | —                          |
| `rag`            | —      | —      | —          | —          | —       | `query`: viewer (ze scope) |
| `access`         | —      | —      | —          | —          | —       | `manage`: **admin**        |
| `user`           | —      | —      | —          | —          | —       | `manage`: **admin**        |

> Zmiana matrycy = zmiana w `POLICY_MATRIX`. Nie ma osobnej tabeli w DB — to celowe (matryca jest pochodną kodu, deploy = nowa polityka, audit ścieżką gita).

---

## 6. Egzekucja w runtime

### 6.1. Globalny `get_current_user`

W `backend/src/app/api/__init__.py` i `backend/src/app/api/v1/__init__.py` wszystkie routery (poza `/auth`) są montowane z `dependencies=[Depends(get_current_user)]`. Brak/nieprawidłowy bearer = 401 zanim cokolwiek innego się wykona.

### 6.2. Trzy metody autoryzacji

W `AuthorizationService`:

| Metoda                       | Kiedy używać                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `authorize_by_policy()`      | **Domyślnie**. Pobiera `min_role` z `POLICY_MATRIX[resource][action]` + scope check. |
| `authorize()` (legacy / MVP) | Tylko gdy nie chcesz mapować na konkretny zasób — używa `_ACTION_TO_MIN_ROLE`.       |
| `ensure_min_role()`          | Tylko sprawdzenie roli (np. `require_admin`), bez scope.                             |

Po zmianie ALF-60 dokumenty **przeszły z `authorize` na `authorize_by_policy(resource="document", ...)`** — dzięki temu policy matrix jest jedynym źródłem prawdy.

### 6.3. Schemat odmowy

Każdy 403 z autoryzacji zwraca:

```json
{
  "detail": {
    "code": "AUTHORIZATION_DENIED",
    "message": "Access denied: user has no scope for requested resource."
  }
}
```

To **kontrakt** dla frontu i Postman testów. `pull_request_review_write`/QA mogą polegać na `detail.code === 'AUTHORIZATION_DENIED'`.

Po dopięciu ALF-60 ten format jest spójny także w `documents.py` (wcześniej zwracał `detail: <string>`).

### 6.4. Egzekucja w fasadzie CRM

`CRMService` (`backend/src/app/service/facade.py`) udostępnia 4 helpery:

- `_authorize_company_resource(resource, action, company_id, contract_id?)` — pełny RBAC + ABAC.
- `_authorize_contract_resource(resource, action, contract_id)` — wyciąga `company_id` z umowy i deleguje wyżej.
- `_authorize_company_filter(resource, action, company_id?, ...)` — dla list endpoints; wymaga przynajmniej _jakiegoś_ scope (chyba że admin).
- `_authorize_role_only(resource, action)` — gdy zasób nie ma _bezpośredniego_ company_id (np. service groups).

Listy są dodatkowo **filtrowane post-fetch** (`_resolve_allowed_company_ids`, `scope.contract_ids`) — tj. nawet gdy fasada by pozwoliła na `list`, zwraca tylko rekordy z scope’u. Admin pomija ten filtr.

---

## 7. Mapa endpointów

| Prefix                                    | Auth     | Authz                                                                  |
| ----------------------------------------- | -------- | ---------------------------------------------------------------------- |
| `POST /api/v1/auth/login/{username}`      | **anon** | —                                                                      |
| `/api/v1/users/*`                         | bearer   | `require_admin` (router-level)                                         |
| `/api/v1/access/users/*`                  | bearer   | `require_admin` (per-endpoint)                                         |
| `/api/v1/companies/*`                     | bearer   | `authorize_by_policy("company", action)` + admin-only `create`         |
| `/api/v1/documents/*`                     | bearer   | `authorize_by_policy("document", action)` w `DocumentService`          |
| `/api/v1/rag/search`                      | bearer   | `authorize_by_policy("rag", "query", company_id=customer.company_id)`  |
| `/api/customers/*`, `/api/contracts/*`, … | bearer   | `CRMService` fasada → `authorize_by_policy(<resource>, <action>, ...)` |

**Pełna lista endpointów per zasób** jest dostępna w `/docs` (FastAPI Swagger) gdy aplikacja jest uruchomiona z `DEBUG=true`.

---

## 8. Endpointy administracyjne (`/api/v1/access/*`)

| Endpoint                                | Auth              | Co robi                                                                                                                                 |
| --------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /access/bootstrap-first-admin`    | bearer (any user) | **Idempotentny self-bootstrap** pierwszego admina. 200 jeśli żaden admin nie istnieje (lub to ja); 403 gdy admin już jest _kimś innym_. |
| `GET /access/users/{user_id}`           | bearer + admin    | Zwraca `{roles, company_ids, contract_ids}` użytkownika.                                                                                |
| `PUT /access/users/{user_id}/roles`     | bearer + admin    | Replace-all listy ról (`{ "roles": ["manager","consultant"] }`).                                                                        |
| `PUT /access/users/{user_id}/companies` | bearer + admin    | Replace-all listy firm (`{ "ids": ["uuid", ...] }`).                                                                                    |
| `PUT /access/users/{user_id}/contracts` | bearer + admin    | Replace-all listy umów (`{ "ids": ["uuid", ...] }`).                                                                                    |

### `bootstrap-first-admin` — co robi i kiedy

Eliminuje potrzebę ręcznego `INSERT INTO user_roles ... ('admin')` na świeżej bazie. Logika:

1. Wymaga zalogowanego usera (musi mieć ważny bearer i istnieć w `users`).
2. Pyta DB: czy _jakikolwiek_ admin już istnieje?
3. Jeśli **nie ma admina** lub jedyny admin to _ja_ → dodaje rekord `(my_id, 'admin')` do `user_roles` (idempotentnie).
4. Jeśli **jest admin, ale to ktoś inny** → 403 z `AUTHORIZATION_DENIED`.

Dzięki temu Postman / E2E mogą wystartować na zupełnie pustej bazie:

```
POST /auth/login/admin_test           → tworzy user 'admin_test' w DB (przez AD upsert)
POST /access/bootstrap-first-admin    → nadaje 'admin_test' rolę admin
… reszta scenariusza działa pod adminem
```

Po pierwszym sukcesie endpoint przy kolejnych runach z tym samym userem zwraca 200 (no-op). Inny user dostanie 403 — to celowy mechanizm zamykania bootstrapu.

> **Pozostałe endpointy zostały zaprojektowane tak, by były idempotentne i zerujące** (replace-all) — łatwiej audytować i wycofywać.

---

## 9. Postman — szybki start

W `backend/postman/` są dwie kolekcje:

- `CRUD.json` — pełna kolekcja CRUD per zasób.
- `HRK-E2E-Deterministic-Full.postman_collection.json` — deterministyczny scenariusz E2E (Setup → Verify → Cleanup).

### 9.1. Globalny Bearer auth

Po dopięciu ALF-60 obie kolekcje używają **collection-level auth**:

```json
"auth": { "type": "bearer", "bearer": [{ "key": "token", "value": "{{bearerToken}}" }] }
```

Każdy request automatycznie wysyła `Authorization: Bearer {{bearerToken}}`. Wyjątkiem są requesty `Login` (mają `auth: noauth`), bo `/auth/login/*` nie wymaga tokena.

### 9.2. Zerowa konfiguracja — wszystkie 3 kolekcje są deterministyczne

Po ALF-60 **żadna z kolekcji nie wymaga ręcznego SQL ani seedowania**. Każde uruchomienie:

- generuje świeży `testRunId = Date.now()` (collection-level `prerequest`),
- wylicza z niego `nipSuffix` / `ckkSuffix` (10-cyfrowe deterministyczne sufiksy),
- domyślnie używa `adminLogin = admin_test` (możesz zmienić w Variables),
- woła `bootstrap-first-admin`, by zalogowany user miał rolę `admin`.

Każdy run jest niezależny: testRunId zmienia się każdorazowo, więc nie ma kolizji unique-constraint na `nip` / `ckk` / `name`.

### 9.3. `CRUD.json` — flow

1. `Auth → Login (admin)` — POST `/auth/login/{{adminLogin}}` (auth: noauth). Upsertuje usera w DB, ustawia `bearerToken = login`, `userId = id`.
2. `Auth → Bootstrap First Admin` — idempotentny self-promote (200 lub 403, oba akceptowane).
3. `Companies → Find or Create Company` — szuka po deterministycznej nazwie; jeśli brak, sam przekierowuje (`setNextRequest`) na `Create Company`.
4. `Customers → Find or Create Customer` — to samo dla customera (po `ckk = {{ckkSuffix}}`).
5. Reszta CRUD-ów per zasób — używa już ustawionych `companyId` / `customerId` / `userId`.
6. Demo deny: `Access → [Deny] Set Roles as Non-Admin (403)` — pre-request switchuje token na `viewerLogin`, oczekuje 403 z `detail.code === 'AUTHORIZATION_DENIED'`, post-request przywraca admina.

### 9.4. `HRK-S3.postman_collection.json` — flow

End-to-end od loginu do delete dokumentu, samosetupujący się. Steps `01..10`:

```
01 - Login (admin)        → upsert usera, set bearerToken
02 - Bootstrap First Admin → role admin
03 - Find or Create Company \  branching przez setNextRequest;
04 - Create Company         /  nigdy nie wykonują się obie
05 - Find or Create Customer
06 - Create Customer        (jw.)
07 - Upload Document        (multipart, używa {{localFilePath}})
08 - Get Document Metadata
09 - Get Presigned Download URL
10 - Delete Document (cleanup)
```

Jedyna zmienna do podmiany: `localFilePath` (ścieżka do realnego pliku PDF/DOCX/TXT/JPEG/PNG ≤10MB). Reszta jest auto-set.

### 9.5. `HRK-E2E-Deterministic-Full` — flow

Pełen E2E CRM (customer, contacts, services, contracts, valorizations, rates, notes, activity logs) z fazami Setup → Verify → Cleanup. Po ALF-60:

- `01 - Login` (auth: noauth) — ustawia `bearerToken = login`,
- `01b - [Bootstrap] First Admin` — idempotentny self-promote przez `bootstrap-first-admin`,
- reszta scenariusza pozostaje deterministyczna (find-or-create) — działa na świeżej bazie.

### 9.6. Przełączanie kont (manual)

- W lewym panelu Postmana → kolekcja → zakładka **Variables** → ustaw `bearerToken` na inny login.
- Albo (w `CRUD.json`): wywołaj `Auth → Login (viewer)` lub `Auth → Switch to Admin`.

---

## 10. Testy

Plik: [`backend/tests/test_rbac_abac.py`](../backend/tests/test_rbac_abac.py).

| Test                                                            | Sprawdza                                                          |
| --------------------------------------------------------------- | ----------------------------------------------------------------- |
| `test_company_create_denies_non_admin`                          | viewer → POST `/companies/` → 403 + `code: AUTHORIZATION_DENIED`. |
| `test_company_create_allows_admin`                              | admin → POST `/companies/` → 201.                                 |
| `test_company_list_returns_only_scoped_companies_for_non_admin` | ABAC: viewer ze scope na firmę A widzi tylko firmę A.             |
| `test_rag_search_denies_without_scope`                          | RAG zwraca 403 gdy brak scope na firmę klienta.                   |
| `test_bootstrap_first_admin_idempotent`                         | self-promote 200 + idempotencja + lock dla obcego usera (403).    |
| `test_access_roles_update_allows_admin_only`                    | non-admin → 403; admin → replace-all i zwraca {roles}.            |

Uruchomienie:

```bash
cd backend
make docker-up        # pgvector + minio + ad
make docker-migrate   # podniesienie schematu
make test-docker      # pełen pakiet w kontekście Dockera
# albo lokalnie (wymaga DB):
poetry run pytest tests/test_rbac_abac.py -v
```

Conftest (`backend/tests/conftest.py`) automatycznie:

- przepisuje `@db:` → `@localhost:` w `DATABASE_URL` (żeby działało spoza Dockera),
- ustawia `DEBUG=true` i tymczasowe credy MinIO,
- fixture `client` od razu się loguje i ustawia bearer.

> Jeśli widzisz `pytest.skip("user_roles table is unavailable")` → migracja nie była uruchomiona. Wykonaj `make docker-migrate` (lub `alembic upgrade head` lokalnie).

---

## 11. Częste pułapki

1. **„Wszystko zwraca 401”** — kolekcja Postman jeszcze sprzed ALF-60. Otwórz aktualną z `backend/postman/`; collection-level Bearer wymaga `bearerToken`.
2. **„Mam admina, a /companies POST zwraca 403”** — sprawdź `GET /access/users/{id}` — być może masz rolę w innej tabeli (legacy `users.role` z drzewa sprzed migracji `1b2c3d4e5f6a`). `users.role` jest **ignorowane** przez `AuthorizationService`; źródłem prawdy jest `user_roles`.
3. **„Lista jest pusta zamiast 403”** — to celowe. Endpointy listujące, gdy nie podasz `company_id`, zwracają **tylko** to co masz w scope. Brak scope = `[]` (a nie 403). Logika: 403 dla operacji jednostkowej, `[]` dla zbiorczej.
4. **„Rola `account_manager` vs `manager`”** — w `_ROLE_RANK` mają **ten sam rank (3)**. To nie pomyłka — biznesowo są równorzędne, różnica leży w innych modułach (np. `Customer.account_manager_id` jest osobną relacją FK do User-a, niezależną od policy).
5. **„Po deletcie z user_company_access user nadal widzi firmę”** — sprawdź czy nie ma jednocześnie `user_contract_access` na umowę z tej firmy. ABAC scope to OR.

---

## 12. Dlaczego tak, a nie JWT/OAuth/policy-engine?

- **Token = login** to MVP zgodny z założeniem ALF-56 (AD jako jedyne źródło tożsamości, brak rejestracji w CRM). Kolejny ticket może podmienić `get_current_user` na walidację JWT bez ruszania `AuthorizationService`.
- **Brak Casbin/OPA** — policy matrix mieści się w 30 liniach Pythona i jest in-process. Zewnętrzny silnik byłby przedwczesnym uogólnieniem.
- **Brak `users.role` jako kolumny** — celowo zrobione w migracji `1b2c3d4e5f6a` (`simplify_users_to_login_email`). Kolumna była ścisłą 1-1, czyli nie pozwalała na "manager + consultant" jednocześnie. M2M `user_roles` to standardowy wzorzec RBAC.

---

_Dokument utrzymywany w `docs/alf-60-rbac-abac.md`. Przy zmianie matrycy uprawnień / endpointów aktualizuj sekcje 5 i 7._
