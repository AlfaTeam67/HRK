# Zakładki karty klienta — szczegóły implementacji

## Zakładka: Umowy

**Komponent:** `features/contracts/ContractTreeList.tsx`
**Helper:** `features/documentGeneration/originHelpers.ts` → `groupContractsByParent()`

### Struktura drzewa

```
▾ 📄 #2024/01  Umowa ramowa     [aktywna]    3 pliki
  │
  │ Aneksy (2)
  │   ├─ 📎 #2024/01-A1  Aneks       [zaakceptowany] 1 plik
  │   └─ 📎 #2024/01-A2  Aneks       [draft]         0 plik
  │
  │ Powiązane (1)
  │   └─ 🔗 #2024/01-SLA SLA         [aktywny]      0 plik

▸ 📄 #2024/05  Umowa SLA         [aktywna]    2 pliki
```

### Algorytm grupowania

1. Umowy bez `parent_contract_id` (lub z orphan parent) → **roots**.
2. Dla każdego roota: dzieci podzielone na `amendments` (`contract_type === 'aneks'`) i `related` (reszta).
3. Sortowanie roots: `start_date` desc. Dzieci: `start_date` asc.

### Zachowanie

- Domyślnie rozwinięte.
- Strzałka `▾`/`▸` toggluje rozwijanie (nie nawiguje).
- Klik w wiersz → `ContractModal`.
- Badge `n plików` = `attachments.filter(d => d.contract_id === c.id).length`.

---

## Zakładka: Dokumenty

**Komponent:** `features/documentGeneration/DocumentsTab.tsx`
**Helper:** `originHelpers.ts` → `buildOrigin()`

### Quick filters

| Filtr | Logika |
|-------|--------|
| Wszystkie | Cały strumień attachments + sekcja „Wymaga akcji" |
| Klient | `attachments.filter(!contract_id)` — sekcja „Wymaga akcji" ukryta |
| Umowy | `attachments.filter(!!contract_id)` |
| Wymaga akcji | Tylko `pendingGens` (generations w statusie preview/draft) |

Dodatkowy dropdown **Typ** filtruje po `document_type`.

### Pochodzenie (OriginLabel)

| Sytuacja | Wyświetlane |
|----------|-------------|
| Brak `contract_id` | „Klienta" |
| `contract_id` bez `parent_contract_id` | „↪ Umowa #X" (klikalne) |
| `contract_id` z `parent_contract_id` | „↪ #parent → typ #child" (klikalne) |

Kliknięcie w pochodzenie → `onOpenContract(contractId)` → przełącza na zakładkę Umowy + otwiera ContractModal.

### Akcja „Otwórz umowę →"

Widoczna przy dokumentach z `contract_id`. Otwiera `ContractModal` dla powiązanej umowy.

### Sekcja „Wymaga akcji"

- Widoczna gdy `pendingGens.length > 0` i filtr ≠ `Klient`.
- Zawiera generations w statusie `preview` / `draft`.
- Akcje: Akceptuj, Odrzuć, Edytuj dane, Pobierz PDF.

### Bulk actions

- Checkbox przy każdym dokumencie.
- Zaznaczenie → pasek: „Włącz w AI" / „Wyłącz w AI" / „Wyczyść".

---

## Props flow

```
ClientsPage
  ├─ ContractTreeList
  │     contracts, attachments, onContractClick
  │
  └─ DocumentsTab
        customerId, onOpenContract
```

`onOpenContract` w `ClientsPage` → `setTab('contracts')` + `setContractModalId(id)`.
