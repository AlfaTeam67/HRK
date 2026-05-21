# Uprawnienia i role

## Cel

Opisać, **co kto widzi i może zrobić** w HRK CRM. W MVP mamy strukturę
ról przygotowaną w schemacie, ale egzekucja jest częściowa — większość
restrykcji jest po stronie UI.

---

## Role w systemie (`UserRole`)

```
admin              # pełen dostęp, zarządzanie userami, raporty
account_manager    # opiekun klienta — własne klienty/umowy
manager            # przełożony — szerszy widok zespołu
viewer             # tylko odczyt
```

Wartości w enumie: zob. [`../data-model/enums.md`](../data-model/enums.md).

---

## Departamenty (FE)

Frontend trzyma `user.department` jako string (z AD) — **nie enum**.
Aktualnie mapowane:

| `department`       | Znaczenie / widoczność |
|--------------------|------------------------|
| `Opiekun klienta`  | Widzi `/managed-dashboard`, lista własnych klientów. |
| `Specjalista HR`   | Widzi główny `/`, dashboard zespołowy. |
| `Administrator IT` | Widzi `/`, dostępy, raporty. |

Filtr w `App.tsx` (`<DashboardRedirect>`) i `AppSidebar.tsx`.

> Mapowanie `department` ↔ `UserRole` **nie jest** dziś sformalizowane.
> Plan: tabela `user_roles` lub mapowanie po `email`/AD groupach.

---

## Co egzekwujemy dziś

### Frontend
- ✅ `RequireAuth` — brak user/token → redirect `/login`.
- ✅ Sidebar i routing — pozycje filtrowane per `user.department`.
- ✅ Self-filter w API — niektóre hooki (np. `useAlerts`) wysyłają
  `?account_manager_id={user.id}` automatycznie.

### Backend
- ⚠️ **Brak twardej autoryzacji.** Każdy zalogowany może wywołać każdy
  endpoint. Ufamy że frontend zachowuje higienę.
- ✅ Obowiązkowe filtry przez query params — np. `account_manager_id`,
  `customer_id`. Endpointy zwracają tylko to, co poproszono.
- ✅ `customer_id` w `document_chunks` — RAG nie wycieknie chunków
  spoza klienta, którego pyta.

---

## Plan na produkcję

```
1. Reverse proxy (Kerberos / OIDC)  →  inject X-Remote-User
2. FastAPI middleware                  →  weryfikuje + ładuje User do request.state
3. Dekorator @requires_role("admin")   →  na endpointach mutujących
4. Service-layer authorization         →  np. CustomerService.get_visible_for(user)
5. Audit log                           →  każda mutacja w audit_logs
```

### Szkic dekoratora
```python
def requires_role(role: UserRole):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, current_user: User, **kwargs):
            if current_user.role != role and current_user.role != UserRole.ADMIN:
                raise HTTPException(403, "Forbidden")
            return await func(*args, current_user=current_user, **kwargs)
        return wrapper
    return decorator
```

### Szkic per-customer access
- Tabela `user_customer_access(user_id, customer_id, access_level)`.
- W `CustomerRepository.list(...)` automatyczny `JOIN` z tą tabelą.
- Account manager widzi tylko swoich klientów.
- Manager widzi cały zespół.

---

## Self-filter (pattern obecny)

```python
# api/v1/dashboard.py
async def get_dashboard_kpi(
    account_manager_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    return await AlertService(db).get_dashboard_kpi(
        account_manager_id=account_manager_id
    )
```

FE woła `?account_manager_id={user.id}` → backend filtruje. Ale **nic
nie powstrzymuje** wywołania bez tego parametru. To jest gentlemen's
agreement, nie bezpieczeństwo.

---

## Co audytujemy

| Akcja | Tabela | Stan |
|---|---|---|
| Tworzenie/zmiana umowy | `audit_logs` (planowane) | Stub gotowy, nie podpięty. |
| Akceptacja generacji | `document_generations.accepted_by` | Tak, kolumna jest. |
| Logowanie | brak | Plan: dodać `user_logins` lub event w `activity_logs`. |
| Pobranie dokumentu (presigned URL) | brak | Plan: `audit_logs` z `action=VIEW`. |

---

## Dalej

- [`active-directory.md`](active-directory.md) — flow logowania.
- [`../storage/minio.md`](../storage/minio.md) — kontrola dostępu do plików.
