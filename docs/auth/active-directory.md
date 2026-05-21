# Autoryzacja przez Active Directory

## Cel

W HRK CRM **nie ma rejestracji użytkowników**. Tożsamości pochodzą z
Active Directory firmy. Ten dokument opisuje:
- jak działa logowanie w MVP,
- jak jest zorganizowany mikroserwis `services/ad`,
- jakie są opcje docelowego SSO (Kerberos / LDAP / OIDC).

> Tekst inspirowany / rozwijający `docs/ad-auth-design.md` (oryginalny
> design doc).

---

## MVP — co działa dziś

### Endpoint
```
POST /api/v1/auth/login/{username}
```

Flow:
1. FE wysyła username (`POST .../login/jkowalski`).
2. Backend (`ADLoginService`) woła mikroserwis AD:
   ```
   GET http://ad:8001/ad/user?identity=HRK\jkowalski
   ```
3. Mikroserwis zwraca dane użytkownika (mock lub LDAP — zob. niżej).
4. Backend tworzy/aktualizuje rekord w tabeli `users` (`login`, `email`).
5. Zwraca `UserRead` do FE.
6. FE zapisuje user'a w Redux (`authSlice.setUser`) i `token` (placeholder
   `'demo-token'`).

### Mikroserwis `services/ad/`

```
services/ad/
├── Dockerfile
├── requirements.txt
├── .env / .env.example
└── app/
    └── ...    # FastAPI: GET /ad/user, /openapi.json
```

Zmienne środowiskowe (per `services/ad/.env`):
```env
AD_APP_NAME=HRK AD Service
AD_DEBUG=false
HOST=0.0.0.0
PORT=8001
AD_SERVER_URL=ldap://localhost:389
AD_DOMAIN=hrk.local
AD_BASE_DN=DC=hrk,DC=local
AD_USE_SSL=false
AD_MOCK_MODE=true                      # true → symulowana tożsamość
AD_SIMULATED_IDENTITY=HRK\asia          # jaką tożsamość zwracać w mock mode
```

`AD_MOCK_MODE=true` jest **domyślne** w dockerze — na potrzeby
developmentu i prezentacji.

### Backend → AD service (`ADLoginService`)

```python
class ADLoginService:
    async def login(self, username: str, db: AsyncSession) -> UserRead:
        ad_user = await self._fetch_ad_user(username)
        login = self._extract_login(ad_user.identity)   # "HRK\asia" → "asia"

        repo = UserRepository(db)
        existing = await repo.get_by_login(login)
        if existing:
            return UserRead.model_validate(existing)

        user = await repo.create({
            "login": login,
            "email": f"{login}@hrk.eu",
        })
        return UserRead.model_validate(user)
```

Normalizacja:
- `jkowalski` → `HRK\jkowalski` (dodaje domenę z `API_AD_DOMAIN`).
- `domena/login` → `domena\login`.
- `DOMAIN\login` → bez zmian.

Timeout HTTP: `AD_REQUEST_TIMEOUT=5.0` s. Przy błędzie:
- `404` → 404 do FE („User not found in AD").
- inne → 502 („AD service is unavailable").

---

## Model `User`

```python
class User(Base):
    __tablename__ = "users"
    id:    UUID
    login: VARCHAR(100) UNIQUE
    email: VARCHAR(255) UNIQUE
```

Brak hasła, brak ról, brak telefonu. Wszystkie metadane (np. zespół)
biorą się z AD lub osobnej integracji w przyszłości.

> Frontend trzyma w Redux `displayName`, `initials`, `department` — **dziś
> są ustawiane lokalnie po loginie**, w przyszłości wezmą się z AD.

---

## Token / sesja

W obecnym MVP:
- Backend **nie wystawia** JWT.
- Frontend trzyma token-placeholder (`'demo-token'`) w Redux + `localStorage`.
- axios interceptor wpisuje go jako `Authorization: Bearer demo-token`.
- Backend **nie weryfikuje** tokenu — endpointy są w praktyce otwarte.

To jest **świadomy MVP-tradeoff**. Planowane rozszerzenia (poniżej).

---

## Opcje docelowe (post-MVP)

### A. Kerberos / SPNEGO + reverse proxy
„Najbliżej prawdziwego AD". Klasyczne **Windows Integrated Authentication**:

```
Browser (domena)  →  Reverse Proxy (Kerberos)  →  FastAPI  →  PostgreSQL
                       weryfikuje ticket
                       wstrzykuje X-Remote-User
```

Plusy: brak ekranu logowania na komputerach domenowych, sprawdzona
firmowo, audytowalna.
Minusy: setup-heavy (DNS, SPN, NTP sync, trusted proxy), urządzenia
spoza domeny wymagają fallbacku.

### B. OIDC (Keycloak) + LDAP federation
Keycloak wystawia ekran logowania, dane userów synchronizowane z AD przez
LDAP federation. Backend dostaje JWT.

Plusy: standardowe, przenośne, łatwe na wieloplatformowe urządzenia.
Minusy: ekran logowania zostaje (brak true SSO).

### C. Dev mode (tylko lokalne testy)
Bypass AD przez flagę `.env`:
```env
AUTH_SKIP_AD=true
AUTH_DEV_USER=admin
AUTH_DEV_ROLE=admin
```

Wbudowany w `ADLoginService` jako fast-path. **Zablokowany** w
`DEBUG=false` (żeby nigdy nie trafił na produkcję).

> Uwaga: w obecnym kodzie ten flag jeszcze **nie jest zaimplementowany** —
> to plan rozszerzenia. AD service `MOCK_MODE=true` daje analogiczny efekt.

---

## Reguły bezpieczeństwa

1. **Tożsamość zawsze z serwera, nigdy z FE.** Nawet w MVP backend
   normalizuje login → odpytuje AD service. Nie ufamy nagłówkowi
   `X-User` z internetu.
2. **AD service tylko po sieci wewnętrznej.** W docker-compose
   `services/ad` jest na sieci `hrk-network`, niewystawione na świat.
3. **Backupy / audit.** Każde utworzenie usera powinno znaleźć się w
   `audit_logs` (TODO — obecnie nie jest podpięte automatycznie).
4. **Nie ufamy LDAP-owi z internetu.** Połączenie z prawdziwym AD —
   tylko po VPN/intranecie + LDAPS.

---

## Frontend — co robi po loginie

```ts
// LoginPage
const { data } = await apiClient.post(`/api/v1/auth/login/${username}`)
dispatch(setUser({
  id: data.id,
  login: data.login,
  email: data.email,
  displayName: 'Asia',          // hardcoded / map per email
  initials: 'AK',
  department: 'Opiekun klienta', // hardcoded
}))
dispatch(setToken('demo-token'))
navigate('/')
```

Persist do `localStorage` (`hrk-auth`). Token `demo-token` jest filtrowany
przy reloadzie (zob. `store.ts`).

---

## Permissions — gdzie je egzekwujemy

| Warstwa | Egzekucja |
|---|---|
| FE — sidebar | Filtr pozycji per `user.department` (`AppSidebar.tsx`). |
| FE — RequireAuth | Brak `user` lub `token` → redirect `/login`. |
| BE — endpoint | **Obecnie:** brak twardych restrykcji. Endpointy CRM zwracają wszystko. |
| BE — filtry per opiekun | Niektóre endpointy wspierają `?account_manager_id=...` jako self-filter. |

Plan: `Depends(get_current_user)` w endpointach, dekorator `requires_role(...)`.

Zob. [`permissions.md`](permissions.md).

---

## Dalej

- [`permissions.md`](permissions.md) — role i zakresy widoku.
- [`../storage/minio.md`](../storage/minio.md) — bezpieczeństwo plików.
- Oryginalny design doc: [`/docs/ad-auth-design.md`](../../docs/ad-auth-design.md).
