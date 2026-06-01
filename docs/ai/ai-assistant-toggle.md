# Przełącznik „Załącz dla asystenta AI" per dokument

## Cel

Daj opiekunowi klienta **pełną kontrolę** nad tym, które dokumenty są
widoczne dla Asystenta AI (RAG). Decyzja o indeksacji ma być podejmowana
**świadomie** w momencie uploadu (z opcją zmiany w dowolnej chwili),
a nie automatycznie.

> Plik łączy się z [`rag.md`](rag.md) (filtr w `DocumentChunkRepository.search`),
> [`document-generation.md`](document-generation.md) (drafty AI dalej idą
> przez `accept`) i [`../workflows/document-upload.md`](../workflows/document-upload.md)
> (rozszerzenie endpointu uploadu).

---

## Decyzje produktowe

| # | Decyzja | Uzasadnienie |
|---|---------|--------------|
| 1 | Switch w 2 miejscach: checkbox w `UploadWizard` (domyślnie ON, etykieta „Załącz dla asystenta AI (zalecane)") **oraz** switch przy każdym wierszu w karcie dokumentów. | Świadoma decyzja przy dodaniu pliku + możliwość zmiany w dowolnej chwili. |
| 2 | W **karcie dokumentów klienta** wszystkie dokumenty są widoczne ze switchem (niezależnie od stanu). W widoku **Asystenta AI** (`AdvisorPage`) widzimy tylko aktywne. | Karta = źródło prawdy. Asystent = lista źródeł kontekstu. |
| 3 | Nie ma osobnego filtra „aktywne / wyłączone" w karcie. Stan widać po stanie switcha. | UI prostszy, bez nadmiarowej kontroli. |
| 4 | **Wyłączanie** wymaga potwierdzenia w modalu: „Wszystkie chunki zostaną skasowane. Plik pozostaje w S3 i można włączyć ponownie." | Operacja kasuje dane, lepsze UX z explicit confirm. |
| 5 | Podczas indeksacji (toggle ON) switch jest **disabled + spinner + badge „Indeksowanie..."**. Po `done` automatycznie ON. | Spójne z istniejącym `OcrStatusBadge` i polling TanStack Query (`refetchInterval=3000`). |
| 6 | `ocr_status='failed'` → switch **disabled**, badge „Błąd indeksacji" + osobny przycisk **„Spróbuj ponownie"** (POST `.../reindex`). | Rozdzielenie czystej intencji od stanu systemu. |
| 7 | Pliki z `mime_type` poza `_PROCESSABLE` (np. DOCX) → switch widoczny i klikalny, klik pokazuje **toast „Format niewspierany przez asystenta AI"** (no-op po BE). | Nie chowamy kontroli, ale komunikujemy ograniczenie. |
| 8 | **Bulk action** (multi-select wierszy + „Włącz/Wyłącz w AI" w toolbarze) wchodzi do MVP. | Pomaga przy seedach / porządkach. |
| 9 | Każda zmiana switcha = wpis w `ActivityLog` (kto, kiedy, on/off, dla którego dokumentu). | Audyt zgodny z istniejącym wzorcem `DocumentGenerationService.accept`. |

**Polityka:**
- **Upload ręczny** → embedding **zawsze** (gdy checkbox ON). Gdy OFF — `ocr_status=skipped`, żaden background task nie startuje.
- **Drafty AI generation** → bez zmian (`ocr_status=skipped` → przy `accept` tworzony nowy `Attachment` z `ocr_status=pending` + background task). Stary draft jest twardo kasowany w `accept` (już w kodzie).

---

## Schemat danych

### Migracja (alembic)

```sql
ALTER TABLE attachments
  ADD COLUMN include_in_ai_assistant BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX idx_att_include_in_ai_assistant
  ON attachments (include_in_ai_assistant)
  WHERE include_in_ai_assistant = TRUE;
```

> Index partial — RAG search wykonuje JOIN tylko po `TRUE`.

### Model `Attachment` (dodanie pola)

```python
include_in_ai_assistant: Mapped[bool] = mapped_column(
    Boolean,
    nullable=False,
    server_default=text("true"),
)
```

### Schemat `DocumentRead`

```python
class DocumentRead(BaseModel):
    ...
    include_in_ai_assistant: bool
```

---

## API

### `POST /api/v1/documents/` (rozszerzenie)

Nowe pole `Form`:

```python
include_in_ai_assistant: bool = Form(True)
```

Zachowanie:
- `True` (domyślnie) → `attachments.include_in_ai_assistant=true`, `ocr_status=pending`, background task **startuje**.
- `False` → `attachments.include_in_ai_assistant=false`, `ocr_status=skipped`, background task **nie startuje**.

### `PATCH /api/v1/documents/{id}/ai-assistant` (nowy)

```http
PATCH /api/v1/documents/{id}/ai-assistant?requester_user_id={user_id}
Content-Type: application/json

{ "enabled": true }
```

Response: **202 Accepted**

```json
{
  "id": "...",
  "include_in_ai_assistant": true,
  "ocr_status": "pending"
}
```

Logika:
- `enabled=true`:
  - jeśli już `include_in_ai_assistant=true` → no-op, zwracaj 200 z aktualnym stanem.
  - jeśli `mime_type` nie jest w `_PROCESSABLE` → 200 + `ocr_status='skipped'` + `include_in_ai_assistant=true` (intencja zapisana, ale chunky nie powstaną).
  - inaczej: `include_in_ai_assistant=true`, `ocr_status='pending'`, fetch z S3, background task `DocumentProcessingService.process`. ActivityLog: „Document X enabled in AI assistant".
- `enabled=false`:
  - `DELETE FROM document_chunks WHERE attachment_id=:id` (przez `DocumentChunkRepository.delete_by_attachment`).
  - `include_in_ai_assistant=false`, `ocr_status` zostaje (lub przesuwa się na `skipped` jeśli był `done` — TBD: zostawiamy `done` żeby pamiętać, że plik był przetworzony; chunki znikają przez explicit DELETE).
  - ActivityLog: „Document X disabled in AI assistant. Chunks removed."

> **Idempotencja:** te same body wysłane dwukrotnie nie powinno się wywalić.

### `POST /api/v1/documents/bulk/ai-assistant` (nowy)

```http
POST /api/v1/documents/bulk/ai-assistant?requester_user_id={user_id}
Content-Type: application/json

{
  "ids": ["uuid1", "uuid2", ...],
  "enabled": false
}
```

Response: **202 Accepted**

```json
{
  "results": [
    { "id": "uuid1", "ok": true,  "ocr_status": "skipped" },
    { "id": "uuid2", "ok": false, "error": "not_found" }
  ]
}
```

Każda zmiana → wpis ActivityLog (jak per-id).

### `POST /api/v1/documents/{id}/reindex` (nowy)

Re-indeksuje dokument z `ocr_status='failed'` (lub każdy z `include_in_ai_assistant=true`).

```http
POST /api/v1/documents/{id}/reindex?requester_user_id={user_id}
```

Response: **202 Accepted** + `{ id, ocr_status: 'pending' }`.

### `GET /api/v1/documents/` (rozszerzenie)

Nowy query param `include_in_ai_assistant_only: bool = False`.

- `False` (domyślnie) — pełna lista (tak jak teraz).
- `True` — filtruje `WHERE include_in_ai_assistant=TRUE AND ocr_status != 'skipped'`. Asystent AI używa tego do listy źródeł.

---

## Filtr w wyszukiwaniu wektorowym

`DocumentChunkRepository.search` musi **zawsze** filtrować po fladze.
Bez tego asystent dalej widzi chunki dezaktywowanych dokumentów (chyba
że zostaną one fizycznie skasowane).

```sql
SELECT id, attachment_id, content, page_number, bbox, section_title,
       (embedding <=> CAST(:vec AS vector(768))) AS vec_score,
       ({keyword_boost}) AS kw_score
FROM document_chunks dc
INNER JOIN attachments a ON a.id = dc.attachment_id
WHERE dc.customer_id = :customer_id
  AND a.include_in_ai_assistant = TRUE
  AND a.deleted_at IS NULL
  AND (dc.embedding <=> CAST(:vec AS vector(768))) < :max_distance
ORDER BY (vec_score - kw_score) ASC
LIMIT :top_k
```

> Defense-in-depth: nawet gdy `delete_by_attachment` z toggle OFF
> nie zdąży się wykonać (race), search nie zwraca tych chunków.

---

## Frontend

### Komponent `AiAssistantToggle`

```tsx
// frontend/src/components/ui/AiAssistantToggle.tsx
type Status =
  | 'on'           // include=true, ocr_status=done
  | 'off'          // include=false (lub skipped przez usera)
  | 'indexing'     // include=true, ocr_status=pending|processing
  | 'failed'       // include=true, ocr_status=failed → retry button
  | 'unsupported'  // mime_type spoza _PROCESSABLE

interface Props {
  attachmentId: string
  initialEnabled: boolean
  ocrStatus: OcrStatus
  mimeType: string | null
  onChange: (enabled: boolean) => void   // fires PATCH
  onRetry?: () => void                    // fires POST /reindex
}
```

Wizual:
- Switch (Radix `<Switch.Root>`, kolory: `#e85c04` ON, `#e3e0db` OFF).
- Stany:
  - `on` → switch ON, badge zielony „W asystencie AI".
  - `off` → switch OFF, badge szary „Wyłączony".
  - `indexing` → switch ON disabled + spinner + badge pomarańczowy „Indeksowanie…".
  - `failed` → switch OFF disabled + badge czerwony „Błąd" + przycisk „Spróbuj ponownie".
  - `unsupported` → switch widoczny i klikalny, ale klik = toast „Format niewspierany".
- Confirm modal (Radix `<AlertDialog>`) przy próbie wyłączenia, gdy stan = `on` i są chunki.

### `UploadWizard`

W kroku `upload` dodaj checkbox pod selekcją typu dokumentu:

```tsx
<label>
  <input type="checkbox" defaultChecked={includeInAi} onChange={...} />
  Załącz dla asystenta AI (zalecane)
</label>
<small>Plik zostanie przetworzony i będzie dostępny w czacie z asystentem.</small>
```

Stan trzymany w `useState`, wysyłany jako `include_in_ai_assistant` w
FormData (`useUploadDocument` mutation).

### `DocumentsTab` (per-row)

W `AttachmentRow` dodaj:
- checkbox multi-select po lewej (do bulk).
- `<AiAssistantToggle>` po prawej obok przycisków `Podgląd` / `Pobierz`.

W toolbarze nad sekcją „Dokumenty ogólne" — gdy zaznaczonych ≥ 1:
```
[Włącz w AI]  [Wyłącz w AI]  (przy OFF: confirm modal)
```

Mutacje TanStack Query:
- `useToggleAiAssistant({ id, enabled })` — PATCH per id.
- `useBulkToggleAiAssistant({ ids, enabled })` — POST bulk.
- `useReindexDocument({ id })` — POST reindex.

Każda zmiana invaliduje `['documents']`.

### `AdvisorPage`

```tsx
useDocumentsQuery({
  customer_id,
  exclude_draft: true,
  include_in_ai_assistant_only: true,   // ← NEW
})
```

Niezmienione poza dodaniem jednego parametru.

---

## Edge case'y

| Scenariusz | Zachowanie |
|------------|-----------|
| Upload PDF, checkbox OFF | `include=false`, `skipped`, brak chunków, brak background task. |
| Upload DOCX, checkbox ON | `include=true`, `skipped` (system fallback), brak chunków. Switch widoczny, retry futile. |
| Toggle OFF → ON na PDF | Reindex z S3, switch w stanie `indexing`, polling 3s do `done`. |
| Toggle OFF → ON na DOCX | `include=true`, `ocr_status=skipped` (no-op), toast „Format niewspierany" lub po prostu pozostaje skipped. |
| Toggle OFF w trakcie processingu | `include=false`, `ocr_status` zachowany (lub `skipped`); `delete_by_attachment` na chunkach gdy się pojawią — race ratuje JOIN w search. |
| Ten sam dokument zaakceptowany dwa razy (regeneracja aneksu) | Stary `Attachment` skasowany w `accept` (już w kodzie). Nowy ma `include=true` (default). |
| `failed` → toggle ON | Endpoint odpowiada 202; reindex próbuje ponownie. |
| Hard-delete dokumentu | CASCADE usuwa chunki. Nic do roboty. |

---

## Bezpieczeństwo i wydajność

- **Permission check**: endpointy PATCH/bulk/reindex mają `requester_user_id` (jak `delete_document`). MVP — to samo co dla pobierania.
- **Race condition**: dwóch userów klika OFF równocześnie → ostatnia wygrywa, `delete_by_attachment` idempotentne.
- **Performance**:
  - JOIN w search: `attachments.id` jest PK, koszt JOIN minimalny.
  - Partial index na `include_in_ai_assistant=TRUE` zmniejsza skan.
- **Idempotencja toggle**: ON → ON nie restartuje processingu (sprawdzamy aktualną wartość przed update).

---

## Migracja danych

Wszystkie istniejące rekordy dostają `include_in_ai_assistant=TRUE` (server_default). Nic do migracji.

---

## Plan implementacji (kolejność commitów)

1. **BE migracja** — alembic `add_include_in_ai_assistant_to_attachments`.
2. **BE model + schema** — pole + Pydantic + repo helpers.
3. **BE upload** — Form field + warunek na background task.
4. **BE toggle endpoint** + bulk + reindex.
5. **BE search filter** — JOIN.
6. **BE list filter** — `include_in_ai_assistant_only`.
7. **BE testy** — coverage edge case'ów.
8. **FE typy** — `npm run types:sync`.
9. **FE komponent + hooki** — `AiAssistantToggle`, `useToggleAiAssistant`, bulk.
10. **FE UploadWizard** — checkbox.
11. **FE DocumentsTab** — wiersze + bulk toolbar.
12. **FE AdvisorPage** — dodanie parametru.

---

## Dalej

- [`rag.md`](rag.md) — zaktualizować sekcję „Schemat danych" o nowy filtr.
- [`../workflows/document-upload.md`](../workflows/document-upload.md) — dodać krok „checkbox w UploadWizard" do flow.
- [`document-generation.md`](document-generation.md) — bez zmian (drafty dalej `skipped` → `accept` → nowy attachment).
