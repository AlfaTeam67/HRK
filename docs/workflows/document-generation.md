# Workflow — generowanie dokumentów (UI / operacyjne)

## Cel

Pokazać **jak operator korzysta z DocumentWizard** w UI, jakie kroki widzi
i co dzieje się po każdym kliknięciu. Techniczne szczegóły serwisu są w
[`../ai/document-generation.md`](../ai/document-generation.md).

---

## Skąd uruchamiamy

- `ContractsPage` → modal → tab „Aneksy" → przycisk **Generuj aneks**.
- `ValorizationPage` → row → akcja **Generuj aneks**.
- `ClientsPage` (tab Dokumenty) → przycisk **Nowy dokument AI**.

Wszystkie ścieżki otwierają to samo: `<DocumentWizard>` z prefillem.

---

## Kroki kreatora

### 1. Wybór szablonu
- `GET /api/v1/document-generations/templates`
- Lista: `amendment_valorization`, `cover_letter`, ... (każdy ma
  `manifest.yml` z `params_schema`).

### 2. Kontekst (klient + umowa)
- Jeśli wszedłeś z `ContractsPage` → kontekst już prefillowany.
- W innym wypadku: wybór klienta → wybór jego aktywnej umowy.

### 3. Parametry
Forma generowana z `params_schema` szablonu. Dla `amendment_valorization`:

| Pole                          | Co znaczy |
|-------------------------------|-----------|
| `index_type` (enum)           | `GUS_CPI` / `fixed_pct` / `custom` |
| `index_value` (Decimal)       | np. 4.50 (procent) |
| `tone` (enum)                 | `formal` / `neutral` / `warm` / `assertive` |
| `include_cover_letter` (bool) | Czy generować pismo przewodnie |
| `include_ai_rationale` (bool) | Czy generować punkty uzasadnienia |
| `user_instructions` (str)     | Wskazówki dla LLM (np. „podkreśl 5 lat współpracy") |
| `services[]`                  | Per ContractService: `include`, `custom_index_pct` |

### 4. Preview
- `POST /api/v1/document-generations/preview` z body `GenerationRequest`.
- Backend liczy symulację (`simulate_valorization`) + renderuje HTML
  (Jinja2). LLM **nie jest** wywoływany.
- UI:
  - Lewa kolumna: tabelka `SimulationSummary` (per usługa, delta yearly,
    weighted avg index).
  - Prawa kolumna: `<iframe srcdoc={rendered_html}>` z zawartością aneksu
    (z DRAFT watermark CSS).

### 5. Finalize
- `POST /api/v1/document-generations?generated_by={user.id}`.
- Backend:
  - Wywołuje LLM (cover letter, rationale) — może trwać 10-30 s.
  - Renderuje PDF z DRAFT watermark.
  - Upload do S3 (`companies/{cid}/generated/{uuid}_aneks_X_DRAFT.pdf`).
  - Zapisuje `DocumentGeneration` (status `preview`) +
    `Attachment` (`ocr_status=skipped`).
- UI: przejście na ekran **Akceptacja**:
  - Podgląd PDF (przez `/document-generations/{id}/preview-html` lub
    `/documents/{att_id}/stream`).
  - Edytor cover lettera (rich text) — operator może doszlifować.
  - Lista rationale bullets — usuwalne.
  - Przyciski **Akceptuj** / **Odrzuć**.

> Edycja cover lettera modyfikuje `ai_artifacts.cover_letter` w
> snapshocie. Re-render PDF dzieje się dopiero przy `accept`.

### 6. Akceptacja
- `POST /api/v1/document-generations/{id}/accept` body:
  `{ "accepted_by": "<user.id>" }`.
- Backend:
  - Re-render PDF bez DRAFT.
  - Upload do S3 (`..._FINAL.pdf`).
  - Nowy `Attachment(ocr_status=pending)` → kolejka chunków.
  - `DocumentGeneration.status=accepted`, `pdf_sha256` zapisany.
  - Stary draft-attachment + plik S3 usuwane (best-effort).
  - Background task indeksuje w RAG.

UI dostaje świeży `GenerationRead`. PDF jest pobierany przez presigned URL.

### 7. Odrzucenie
- `POST /api/v1/document-generations/{id}/reject?rejected_by=<user.id>`.
- Status → `rejected`. Plik draft pozostaje (do wglądu) lub usuwany —
  TODO: jednoznaczna polityka.

---

## Widoczność w UI

### Asystent AI (`AdvisorPage`)
- `GET /api/v1/documents?customer_id=...&exclude_draft=true`
  → tylko `ocr_status != 'skipped'`.
- Drafty (`skipped`) ukryte.
- Po akceptacji: status pending → processing → done (badge spinner →
  ✅).

### Zakładka „Dokumenty" (`ClientsPage`, `ContractsPage`)
- `GET /api/v1/documents?customer_id=...`
- **Bez** `exclude_draft=true` — pokazuje wszystkie.
- Generacje w statusie `preview` ⇒ sekcja **„Do akceptacji"** na górze
  (pomarańczowe tło) z przyciskami.
- Po akceptacji plik jest „normalnym" załącznikiem umowy.

---

## Sekwencja diagram (skrót)

```
┌───────┐    ┌───────────────────┐    ┌─────┐    ┌─────────┐    ┌──────┐
│ User  │    │ DocumentWizard FE │    │ API │    │ Service │    │ S3   │
└───┬───┘    └─────────┬─────────┘    └──┬──┘    └────┬────┘    └──┬───┘
    │  start          │                  │            │            │
    │────────────────▶│                  │            │            │
    │  fill params    │                  │            │            │
    │────────────────▶│  POST /preview   │            │            │
    │                 │─────────────────▶│            │            │
    │                 │                  │ simulate + │            │
    │                 │                  │ render HTML│            │
    │                 │                  │───────────▶│            │
    │                 │ ◀── HTML + sim ──│            │            │
    │  accept preview │                  │            │            │
    │────────────────▶│  POST /          │            │            │
    │                 │─────────────────▶│            │            │
    │                 │                  │  LLM gen   │            │
    │                 │                  │  render PDF│            │
    │                 │                  │            │ upload     │
    │                 │                  │────────────┼───────────▶│
    │                 │                  │ INSERT     │            │
    │                 │                  │ generation │            │
    │                 │ ◀── 201 Created ─│            │            │
    │ review preview  │                  │            │            │
    │────────────────▶│                  │            │            │
    │ click Accept    │                  │            │            │
    │────────────────▶│  POST /{id}/accept           │            │
    │                 │─────────────────▶│            │            │
    │                 │                  │ re-render  │            │
    │                 │                  │ upload FINAL─────────▶ │
    │                 │                  │ delete draft──────────▶│
    │                 │                  │ status=accepted        │
    │                 │ ◀── 200 OK ──────│            │            │
    │  download PDF   │                  │            │            │
    │  (presigned)    │                  │            │            │
    │←────────────────────────────────────────────────────────────│
```

---

## Co później (post-MVP)

- Auto-tworzenie `ContractAmendment` po akceptacji.
- Wysyłka mailem + szablon e-podpisu.
- Wersjonowanie generacji (`superseded` przy regeneracji).
- Wsparcie dla większej palety szablonów (np. wezwanie do zapłaty,
  rozwiązanie umowy).

---

## Dalej

- [`../ai/document-generation.md`](../ai/document-generation.md) —
  techniczne szczegóły (templates, simulator, LLM, PDF renderer).
- [`valorization.md`](valorization.md) — biznesowy cykl waloryzacji.
- [`document-upload.md`](document-upload.md) — co dalej z PDF (RAG).
