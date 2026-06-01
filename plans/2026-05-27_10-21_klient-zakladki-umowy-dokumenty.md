# Plan: Reorganizacja zakładek „Umowy" i „Dokumenty" na karcie klienta

**Data:** 2026-05-27
**Autor:** Senior Dev (na zlecenie M. Ciolkowski)
**Status:** Do akceptacji (zakres > 5 plików — wymaga zgody)

---

## 1. Cel

W karcie klienta (`/clients/:customerId`) uporządkować dwie zakładki:

- **Umowy** — wszystko związane z umowami: lista umów macierzystych
  z zagnieżdżonymi aneksami i powiązanymi umowami (SLA/DPA/PPK).
- **Dokumenty** — wszystkie pliki klienta w jednolitym strumieniu,
  z czytelnym wskazaniem pochodzenia (klient / umowa / aneks),
  z filtrami szybkimi i sekcją „Wymaga akcji" u góry.

Cel: redukcja kognitywna („gdzie to było?"), wspólna semantyka akcji,
intuicyjna nawigacja między zakładkami.

---

## 2. Decyzje projektowe (zatwierdzone w Q&A)

| Nr | Decyzja |
|----|---------|
| 1  | Drzewo umów: macierzysta → wcięte aneksy/powiązane (po rozwinięciu). |
| 2  | Klik w umowę → `ContractModal` (jak teraz). Bez akordeonu inline. |
| 3  | Strumień + sekcja „Wymaga akcji" przyklejona u góry. |
| 4  | Pełne akcje (Podgląd, Pobierz, AI toggle). Edycja/usuwanie tylko z modalu umowy. |
| 5  | „Pochodzenie" jako klikalna linia tekstu (`↪ Umowa #X → Aneks #X-A1`). |
| 6  | Drafty (`document_generations`) widoczne w „Wymaga akcji" oraz w modalu umowy. |
| 7  | Quick filters: `Wszystkie | Klient | Umowy | Wymaga akcji` + dropdown typu. |
| 8  | Nazwy zakładek bez zmian: `Informacje | Umowy | Dokumenty | Notatki | Oś czasu`. |
| 9  | Bez filtrów listy umów na MVP. |
| 10 | W drzewie pod umową macierzystą **dwie osobne grupy**: `Aneksy` (typ=`aneks`) oraz `Powiązane` (typ ∈ {SLA, DPA, PPK, inne}). |

---

## 3. UX / Wireframe (tekstowo)

### 3.1 Zakładka **Umowy**

```
┌─ Lista umów klienta ────────────────────────────────────────┐
│                                                              │
│ ▾ 📄 #2024/01  Umowa ramowa     [aktywna]    3 pliki        │
│   │                                                          │
│   │ ▸ Aneksy (2)                                             │
│   │   ├─ 📎 #2024/01-A1  Aneks       [zaakceptowany] 1 plik │
│   │   └─ 📎 #2024/01-A2  Aneks       [draft]         0 plik │
│   │                                                          │
│   │ ▸ Powiązane (1)                                          │
│   │   └─ 🔗 #2024/01-SLA SLA         [aktywny]      0 plik  │
│                                                              │
│ ▸ 📄 #2024/05  Umowa SLA         [aktywna]    2 pliki        │
│ ▸ 📄 #2024/12  Umowa terminacja  [wygasająca] 1 plik         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Zachowanie:**
- Domyślnie wszystkie umowy macierzyste **rozwinięte**.
- Strzałka `▾`/`▸` toggluje rozwijanie (nie nawiguje — żeby wycofanie
  było tanie).
- Klik w nazwę / wiersz → `ContractModal` z `contractId` tej umowy.
- Badge `n plików` = liczba `attachments.filter(d => d.contract_id === c.id)`.
- Bez aneksów dziecko-children wciąż renderowane (dla generycznego API).
- Aneksy mają **wcięcie** + ikonę 📎 + badge `aneks` (lub typu).

**Grupowanie:**
- `parents = contracts.filter(c => !c.parent_contract_id)`
- Dla każdego rodzica: `children = contracts.filter(c => c.parent_contract_id === parent.id)`
- Sortowanie rodziców: po `start_date` desc.
- Sortowanie dzieci: po `start_date` asc.
- „Sieroty" (parent_contract_id wskazuje na nieobecny rekord) traktujemy
  jak rodziców (failsafe).

### 3.2 Zakładka **Dokumenty**

```
┌─ Filtry ──────────────────────────────────────────────────────┐
│ [Wszystkie] [Klient] [Umowy] [Wymaga akcji]  Typ: ▾ [+ Dodaj] │
└──────────────────────────────────────────────────────────────┘

╔═ Wymaga akcji (3) ═══════════════════════════════════════════╗
║ ✦ DRAFT  Aneks waloryzacyjny v3                              ║
║   ↪ Umowa #2024/01 ramowa · Δ rok: +12 400 zł · 26 maj 2026  ║
║   [Akceptuj] [Edytuj dane] [Odrzuć] [Podgląd]                 ║
╚══════════════════════════════════════════════════════════════╝

📄 Pełnomocnictwo_2024.pdf
   Klienta · power_of_attorney · AI: ON · 12 mar 2024
   ☐  [Podgląd] [Pobierz] [● AI]

📄 Aneks_2024_01-A1.pdf
   ↪ Umowa #2024/01 → Aneks #2024/01-A1 · amendment · AI: ON
   ☐  [Podgląd] [Pobierz] [● AI] [Otwórz umowę →]

📄 SLA_2024_01.pdf
   ↪ Umowa #2024/01 → SLA #2024/01-SLA · contract · AI: OFF
   ☐  [Podgląd] [Pobierz] [○ AI] [Otwórz umowę →]
```

**Zachowanie:**
- Quick filter (`Wszystkie | Klient | Umowy | Wymaga akcji`) ustawia
  filtr lokalny (state w `ClientsPage` lub child component).
  - `Wszystkie` — wszystkie attachmenty + drafty.
  - `Klient` — `attachments.filter(!contract_id)`.
  - `Umowy` — `attachments.filter(!!contract_id)`.
  - `Wymaga akcji` — tylko `pendingGens`.
- Dropdown `Typ` filtruje po `document_type`
  (`contract | amendment | power_of_attorney | DPA | PPK | report | cover_letter | other`).
- Sekcja „Wymaga akcji" zawsze na górze (sticky), nawet przy aktywnym
  filtrze innym niż `Wymaga akcji` — chyba że filtr `Klient`
  (wtedy sekcja ukryta, bo i tak nieistotna).
  - Kompromis: sekcja widoczna zawsze, jeśli `pendingGens.length > 0`,
    ale w trybie kompaktowym (jedna linia + collapse).
- Pochodzenie:
  - Brak `contract_id` → `Klienta`.
  - Z `contract_id` i bez `parent_contract_id` na umowie →
    `↪ Umowa #X (typ)`.
  - Z `contract_id` i z `parent_contract_id` na umowie →
    `↪ Umowa #parent → typ #child`.
  - **Klikalne** — przerzuca na zakładkę `Umowy` z auto-rozwinięciem
    macierzystej + (opcjonalnie) auto-otwarciem `ContractModal`.
- Akcja `Otwórz umowę →` (skrót) bezpośrednio otwiera modal.
- Bulk akcje (zaznacz checkbox) dostępne jak teraz: AI on/off bulk.
- Edycja metadanych / usuwanie pliku z umowy → tylko z `ContractModal`
  (zostawiamy obecny przepływ, plik z `contract_id` w UI Dokumentów
  ma akcję `Otwórz umowę →` zamiast `Usuń`).

---

## 4. Zmiany w kodzie

### 4.1 Frontend

**Pliki do edycji:**

| Plik | Zakres | Szac. linii |
|------|--------|-------------|
| `frontend/src/pages/ClientsPage.tsx` | Zakładka „Umowy": wymiana płaskiej listy na drzewo. Drobny refaktor renderera + nawigacja do zakładki Dokumenty z filtrem. | ~60 |
| `frontend/src/features/documentGeneration/DocumentsTab.tsx` | Przebudowa: filtry, ujednolicony strumień, kolumna „Pochodzenie", akcja `Otwórz umowę →`, zachowanie sekcji „Wymaga akcji" + bulk action.  | ~180 |
| `frontend/src/features/contracts/ContractTreeList.tsx` | **Nowy plik** — komponent drzewa umów (z rozwijaniem, badge'ami, akcjami klików). Wyizolowany z `ClientsPage` żeby zachować czystość. | ~120 |
| `frontend/src/features/documentGeneration/originHelpers.ts` | **Nowy plik** — helpery: `buildOriginLabel(doc, contracts)`, `groupContractsByParent(contracts)`. | ~40 |
| `docs/frontend/pages-and-features.md` | Aktualizacja sekcji `ClientsPage` (zmieniona zawartość zakładek). | ~15 |
| `docs/frontend/clients-page-tabs.md` | **Nowy** — szczegółowy opis nowych zakładek (drzewo, filtry, pochodzenie). | ~80 |

**Razem: 6 plików, ~495 linii** (z czego 2 nowe pliki źródłowe + 1 nowy plik docs; właściwa modyfikacja istniejących plików ~255 linii).

### 4.2 Backend

**Brak zmian.** Wszystkie potrzebne dane są dostępne:
- `useContracts({ customer_id })` zwraca już `parent_contract_id` i `contract_type`.
- `useDocumentsQuery({ customer_id })` zwraca `contract_id` i `document_type`.
- `useDocumentGenerations(customerId)` jak teraz.

### 4.3 Testy

- **Frontend nie ma test runnera (sprawdzone — brak `*.test.tsx`).**
- W ramach tego zadania **NIE** stawiam vitest/RTL — to oddzielna,
  duża decyzja architektoniczna. Zgłaszam jako otwartą sugestię
  w kolejnych krokach.
- Smoke test: `npm run lint`, `npm run build`, ręczna weryfikacja.

---

## 5. Algorytmy / Helpery

### 5.1 `groupContractsByParent`

```ts
type ContractTree = {
  parent: ContractRead
  amendments: ContractRead[]    // contract_type === 'aneks'
  related: ContractRead[]       // SLA / DPA / PPK / inne
}

function groupContractsByParent(contracts: ContractRead[]): ContractTree[] {
  const childrenByParent = new Map<string, ContractRead[]>()
  const roots: ContractRead[] = []
  const idSet = new Set(contracts.map(c => c.id))

  for (const c of contracts) {
    const isOrphan = c.parent_contract_id && !idSet.has(c.parent_contract_id)
    if (!c.parent_contract_id || isOrphan) {
      roots.push(c)
    } else {
      const arr = childrenByParent.get(c.parent_contract_id!) ?? []
      arr.push(c)
      childrenByParent.set(c.parent_contract_id!, arr)
    }
  }

  return roots
    .sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))
    .map(parent => {
      const children = childrenByParent.get(parent.id) ?? []
      const sorted = children.sort(
        (a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? '')
      )
      return {
        parent,
        amendments: sorted.filter(c => c.contract_type === 'aneks'),
        related: sorted.filter(c => c.contract_type !== 'aneks'),
      }
    })
}
```

### 5.2 `buildOriginLabel`

```ts
type Origin =
  | { kind: 'client' }
  | { kind: 'contract'; contract: ContractRead }
  | { kind: 'amendment'; parent: ContractRead; child: ContractRead }

function buildOrigin(doc: DocumentRead, contracts: ContractRead[]): Origin {
  if (!doc.contract_id) return { kind: 'client' }
  const child = contracts.find(c => c.id === doc.contract_id)
  if (!child) return { kind: 'client' } // failsafe
  if (!child.parent_contract_id) return { kind: 'contract', contract: child }
  const parent = contracts.find(c => c.id === child.parent_contract_id)
  if (!parent) return { kind: 'contract', contract: child }
  return { kind: 'amendment', parent, child }
}
```

---

## 6. Migracja stanu / nawigacja

- W `ClientsPage` parametr URL `?tab=documents&filter=requires-action`
  (opcjonalny `filter` query-param) umożliwia deep link z drzewa umów
  na pre-filtered listę dokumentów.
- Klikiem w „pochodzenie" w Dokumentach → `setTab('contracts')` + scroll
  do wiersza danej umowy + auto-rozwinięcie + (opcjonalnie) otwarcie modalu.
  - **MVP**: tylko `setTab('contracts')` + auto-rozwinięcie macierzystej
    (parametr `?tab=contracts&open=<contractId>` lub state lokalny).

---

## 7. Wpływ na obecne funkcje

- `UploadWizard` — bez zmian (nadal działa z `DocumentsTab` przez
  `setUploadWizardOpen`).
- `DocumentWizard` — bez zmian (nadal działa).
- `ContractModal` — bez zmian funkcjonalnych. Wewnętrzna zakładka
  `Dokumenty (n)` może w przyszłości dostać sekcję „Aneksy"
  (umowy podrzędne), ale to NIE w tym ticketcie.
- AI assistant — toggle działa identycznie (bo używa tych samych hooków
  `useToggleAiAssistant` i `useBulkToggleAiAssistant`).

---

## 8. Definition of Done

- [ ] `npm run build` przechodzi bez błędów i nowych ostrzeżeń.
- [ ] `npm run lint` czysty.
- [ ] `npm run format:check` czysty.
- [ ] Ręczna weryfikacja:
  - drzewo umów rozwija/zwija się; aneksy widoczne pod macierzystą
  - badge `n plików` zgodne z liczbą faktycznych załączników
  - filtry w „Dokumentach" (`Wszystkie/Klient/Umowy/Wymaga akcji`) działają
  - pochodzenie pliku klikalne → przekierowuje na zakładkę Umowy
  - akcja „Otwórz umowę →" otwiera `ContractModal`
  - sekcja „Wymaga akcji" widoczna z `pendingGens.length > 0`
  - akcje masowe AI on/off działają
- [ ] Dokumentacja:
  - `docs/frontend/pages-and-features.md` zaktualizowane (sekcja `ClientsPage`)
  - `docs/frontend/clients-page-tabs.md` utworzone
- [ ] Bez zmiany schematu DB / API.
- [ ] Surgical strike: tylko niezbędne zmiany w istniejących plikach.

---

## 9. Ryzyka / Otwarte kwestie

1. **Brak testów frontendowych** — regression tylko poprzez ręczne
   testowanie w `npm run dev`. Sugeruję otworzyć osobny ticket
   na setup `vitest` + RTL.
2. **Wydajność drzewa** — przy klientach z 50+ umowami warto
   rozważyć virtualizację. Na MVP zakładamy ≤ 20 umów / klient.
3. **Synchronizacja stanu między tabami** (URL query vs lokalny state) —
   trzymamy się obecnego wzorca `tabState` + `searchParams`,
   z dodatkowym parametrem `?contracts.open=<id>`.
4. **i18n** — wszystkie nowe etykiety hardcoded po polsku
   (zgodnie z resztą UI).

---

## 10. Następne kroki po akceptacji

1. Implementacja w kolejności:
   1. `originHelpers.ts` (czyste funkcje, łatwe do zweryfikowania).
   2. `ContractTreeList.tsx` (izolowany komponent).
   3. Refaktor zakładki Umowy w `ClientsPage.tsx` (podstawienie nowego komponentu).
   4. Refaktor `DocumentsTab.tsx` (filtry + pochodzenie + akcja).
   5. Aktualizacja docs.
2. `npm run lint && npm run format && npm run build`.
3. Manualny smoke test.
4. Pull Request lub `mc-code-reviewer`.
