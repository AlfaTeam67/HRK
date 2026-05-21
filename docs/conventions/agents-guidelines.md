# Konwencje i wytyczne (dla agentów AI i programistów)

## Cel

Spis zasad, które trzymają HRK CRM w spójnym stanie. Agenty AI
(Claude / GPT / Kiro / Cursor) i ludzie powinni je traktować jako
**źródło prawdy** przy wprowadzaniu zmian.

> Plik komplementarny do `/AGENTS.md`, `/CLAUDE.md`,
> `/.github/copilot-instructions.md` w korzeniu repo. Tutaj zbieramy
> rzeczy specyficzne dla pracy nad **kodem produkcyjnym**.

---

## Generalne zasady

1. **Czytaj kod, nie zgaduj.** Przed napisaniem zmiany — spojrzyj na
   istniejące wzorce w sąsiednim module.
2. **Trzymaj się warstw.** API → Service → Repo → DB. Nie skacz w bok.
3. **Migracje przez Alembic.** Po każdej zmianie modelu →
   `make makemigration` + przegląd diffu.
4. **Typy FE/BE w sync.** Po zmianie schematu Pydantic →
   `npm run types:sync` na froncie.
5. **Mały commit > duży.** Jedna zmiana = jedna intencja.
6. **Testy idą z featurem.** Jeśli dodajesz endpoint, dodaj test
   integracyjny (`backend/tests/`).
7. **Dokumentuj decyzje.** Jeśli wybierasz między A i B, napisz w
   commit message lub w `docs/` dlaczego.

---

## Backend — checklist przy zmianie

### Dodanie nowego endpointu
- [ ] Schemat Pydantic w `app/schemas/<module>.py` (Create / Update / Read).
- [ ] Repo (jeśli nowa encja) w `app/repo/<module>.py` dziedzicząc
  z `BaseRepository`.
- [ ] Serwis w `app/service/<module>.py` (logika domenowa).
- [ ] Router w `app/api/v1/<module>.py` z `Depends`, `response_model`,
  poprawnymi statusami HTTP (200/201/204/400/403/404/422/502).
- [ ] Dorzucenie w `app/api/v1/__init__.py`.
- [ ] **Brak `await db.commit()` w repo.** Commit w endpoint'cie /
  serwisie.
- [ ] **Brak SQLAlchemy w API routerze.** Tylko `Depends(get_*_service)`.
- [ ] Test integracyjny (`tests/test_<module>_api.py`) z `TestClient`.
- [ ] `make check` przechodzi (lint + mypy + test + bandit).

### Dodanie nowego modelu
- [ ] Plik w `app/models/<encja>.py`. Mixiny: `TimestampMixin` /
  `CreatedAtMixin` / `SoftDeleteMixin` / `AuditMixin` wedle kontekstu.
- [ ] **Import w `app/models/__init__.py`** — inaczej Alembic go nie
  zauważy.
- [ ] PK to `UUID(as_uuid=True)` z `default=uuid.uuid4`.
- [ ] Daty: `Date` lub `TIMESTAMP(timezone=True)`. **Nigdy**
  `TIMESTAMP` bez tz.
- [ ] Pieniądze: `Numeric(10, 2)`. Nigdy `Float`.
- [ ] FK: jawnie `ondelete=...` (CASCADE / SET NULL / RESTRICT).
- [ ] Enumy: `sa.Enum(MyEnum, create_constraint=False, native_enum=False,
  values_callable=...)`.
- [ ] `additional_data: JSONB` z `server_default=text("'{}'::jsonb")`,
  `nullable=False`.
- [ ] Indeksy w `__table_args__`. Nazwy zaczynają się od `idx_<table>_...`.
- [ ] `make makemigration MSG="add <table>"` + przegląd pliku.

### Modyfikacja istniejącego modelu
- [ ] Edytuj plik w `models/`.
- [ ] `make makemigration MSG="add <column> to <table>"`.
- [ ] **Otwórz** wygenerowaną migrację. Sprawdź:
  - Czy nie zmienia constraintów, których nie chcesz.
  - Czy `nullable=False` na nowej kolumnie ma `server_default`
    (inaczej padnie na non-empty tabeli).
- [ ] Aktualizuj schemat Pydantic + repo + serwis.
- [ ] `npm run types:sync` na froncie.

---

## Frontend — checklist przy zmianie

### Dodanie nowej strony
- [ ] Plik w `src/pages/<NamePage>.tsx`.
- [ ] Route w `src/App.tsx` (wewnątrz `<RequireAuth>` + `<AppLayout>`).
- [ ] Pozycja w sidebarze (`AppSidebar.tsx`) z odpowiednią ikoną
  i filtrem `department`.
- [ ] Hooki w `src/hooks/<encja>.ts`.

### Dodanie nowego query / mutacji
- [ ] Hook w `src/hooks/<encja>.ts`.
- [ ] `queryKey` zaczyna się od string-tagu encji.
- [ ] `enabled: !!id` gdy parametr może być undefined.
- [ ] Mutacja: `onSuccess: () => qc.invalidateQueries({ queryKey: [tag] })`.
- [ ] Typy z `components['schemas'][...]` z `@/types/api`.

### Po zmianie endpointu / schematu BE
- [ ] Backend działa na `:8000` z `DEBUG=true`.
- [ ] `npm run types:sync` (regen `src/types/api.ts`).
- [ ] Sprawdź TS errors w IDE → popraw kod.
- [ ] `npm run lint && npm run build`.

---

## Antywzorce, których unikamy

### Backend
- ❌ `select(...)` w API routerze.
- ❌ `await db.commit()` w `app/repo/`.
- ❌ Twardy `print()` zamiast `logger.info(...)`.
- ❌ `try/except: pass` bez logu.
- ❌ Brak `response_model` w endpointcie.
- ❌ Mieszanie sync z async (`time.sleep` w async funkcji →
  `await asyncio.sleep`).
- ❌ `os.environ["..."]` zamiast `settings.foo`.
- ❌ Hardcoded URL-e zamiast `settings.fe_domain`, `OLLAMA_URL`, ...
- ❌ Błąd 500 przy walidacji wejścia — używaj 400/422.
- ❌ Bare `Exception` w `except` — łap konkretne (`SQLAlchemyError`,
  `httpx.HTTPError`, ...).

### Frontend
- ❌ `axios.create()` w komponencie.
- ❌ `useEffect(() => fetch(...))` zamiast `useQuery`.
- ❌ Mutowanie obiektów z Query (`data.foo = ...`).
- ❌ Trzymanie listy klientów / umów w Redux.
- ❌ Edycja `src/types/api.ts` ręcznie.
- ❌ Wartości stylów inline gdy istnieje klasa Tailwind.
- ❌ Twardy URL `http://localhost:8000` w kodzie.
- ❌ `dispatch(setUser(...))` bez `setToken(...)`.

---

## Naming

### Backend
- Pliki: `snake_case.py`.
- Klasy: `PascalCase`.
- Funkcje / metody / zmienne: `snake_case`.
- Stałe: `UPPER_SNAKE_CASE`.
- Modele: liczba **pojedyncza** (`Customer`, `Contract`).
- Tabele: liczba **mnoga** (`customers`, `contracts`).
- Repos: `<Encja>Repository` (np. `CustomerRepository`).
- Serwisy: `<Domena>Service` (np. `DocumentService`, `RAGService`).
- Schematy Pydantic: `<Encja>{Create|Update|Read}`.

### Frontend
- Komponenty: `PascalCase.tsx` (`ContractsPage`, `UploadWizard`).
- Hooki: `camelCase.ts` (`useCustomers`, `useAlertWebSockets`).
- Pliki utility: `camelCase.ts` (`axios.ts`, `queryClient.ts`).
- Foldery: `kebab-case` lub `camelCase` zgodnie z otoczeniem (zob.
  istniejące — `documentGeneration/`, `contracts/`).

---

## Komentarze i docstringi

### Kiedy pisać
- ✅ **Dlaczego**, nie **co**. Kod pokazuje co, komentarz wyjaśnia powód.
- ✅ Nieoczywiste decyzje (np. „pre-filter `customer_id` zamiast joina —
  potrzebne dla HNSW").
- ✅ Workaroundy / TODO z numerem zadania (`# TODO ALF-42 — ...`).
- ✅ Konwencje formatu danych (np. „bbox: {x0, y0, x1, y1} w punktach
  PDF").

### Kiedy nie pisać
- ❌ `# increment counter` nad `i += 1`.
- ❌ Kopiowanie nazwy funkcji do docstringa.
- ❌ Komentarze które kłamią po refaktorze.

### Format
Backend (Google-style):
```python
def upload_document(
    self,
    *,
    file: UploadFile,
    document_type: DocumentType,
    ...,
) -> Attachment:
    """Upload + persist + schedule background processing.

    Returns the persisted Attachment with `ocr_status='pending'`.
    The chunking + embedding run as a BackgroundTask scheduled
    AFTER the HTTP response is flushed.

    Raises:
        DocumentValidationError: invalid file or missing relations.
        DocumentStorageError:    S3 upload / cleanup failure.
        DocumentError:           DB persistence failure (S3 cleaned).
    """
```

Frontend (TSDoc-lite):
```ts
/** Lista klientów z filtrami; cache 30 s. */
export function useCustomers(params: { ... }) { ... }
```

---

## Praca z LLM-em (agentem)

### Co dawać agentowi do kontekstu
- `AGENTS.md` (root).
- `docs/README.md` + relevantny pod-katalog `docs/`.
- Plik, który zmienia + bezpośredni rodzice/dzieci (np. modyfikujesz
  serwis → daj też endpoint i repo).
- Postanowienia z tego dokumentu.

### Czego NIE dawać agentowi
- Sekretów (`.env` z prawdziwym `OPENROUTER_API_KEY`).
- Plików z `node_modules/`, `dist/`, `.mypy_cache/`.

### Jak prosić o zmianę
- ❌ „Popraw ten kod" — za szerokie.
- ✅ „Dodaj endpoint `GET /customers/{id}/balance` zwracający sumę
  `applied` waloryzacji za bieżący rok. Skonsultuj się z istniejącym
  `customers.py` (router + service + repo)."

### Wymagaj od agenta
- Pełen plan przed zmianą (jakie pliki, jakie kroki).
- Ostrzeżenie przy nieoczywistych konsekwencjach (np. „dodanie kolumny
  wymaga migracji — czy mam ją wygenerować?").
- Po wprowadzeniu zmian: `make check` po stronie BE, `npm run lint`
  + `build` po stronie FE.

---

## Bezpieczeństwo

- Sekrety idą do `.env`, **nigdy** do gita. `.env.example` ma
  placeholdery.
- Pliki `.env` dla `services/ad/` i głównego backendu są oddzielne.
- Pre-commit hook (TODO) blokujący commit `.env` z prawdziwymi
  kluczami.
- W razie wycieku klucza OpenRouter / S3 — natychmiast rotuj.

---

## Język

- Kod, kommenty, docstringi — **angielski**.
- Domena biznesowa w stringach (statusy, opisy, prompts) — **polski**
  (HRK to firma polska).
- Dokumentacja w `docs/` — **polski**.
- Nazwy zmiennych biznesowych — angielski (`customer`, `contract`,
  `valorization`), nie `klient`, `umowa`.

---

## Dalej

- [`coding-style.md`](coding-style.md) — szczegóły lint / mypy / format.
- [`git-workflow.md`](git-workflow.md) — branche, commity, PR.
- [`../operations/testing.md`](../operations/testing.md) — strategia QA.
- [`../glossary.md`](../glossary.md) — słownik pojęć.
