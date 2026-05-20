# Document Generation Flow

Przepływ generowania, akceptacji i indeksowania dokumentów AI.

---

## Architektura

```
API router → DocumentGenerationService → repositories → SQLAlchemy
                      ↓
              DocumentProcessingService (background task)
                      ↓
              EmbeddingService → DocumentChunkRepository (pgvector)
```

---

## Stany generacji (`DocumentGenerationStatus`)

| Status | Opis |
|--------|------|
| `PREVIEW` | Draft wygenerowany, czeka na akceptację |
| `ACCEPTED` | Zaakceptowany, czysty PDF w S3, indeksowany w RAG |
| `REJECTED` | Odrzucony przez opiekuna |

---

## Przepływ `finalize` (tworzenie draftu)

1. Renderuje HTML z `draft=True` (znak wodny DRAFT)
2. Konwertuje do PDF przez `PdfRenderer` (WeasyPrint)
3. Uploaduje do S3: `companies/{company_id}/generated/{uuid}_aneks_X_DRAFT.pdf`
4. Tworzy `Attachment` z **`ocr_status = 'skipped'`** — draft nigdy nie trafia do RAG
5. Tworzy rekord `DocumentGeneration` (status: `PREVIEW`)

**Kluczowe:** `ocr_status = 'skipped'` jest sygnałem że plik jest draftem i nie powinien być widoczny w Asystencie AI.

---

## Przepływ `accept` (akceptacja)

1. Zapisuje klucze S3 i ID starych draft-załączników (plain Python types przed commitem)
2. Renderuje HTML z `draft=False` (brak znaku wodnego)
3. Uploaduje do S3 jako **nowe** załączniki z `ocr_status = 'pending'`
4. Aktualizuje `DocumentGeneration`: nowe `attachment_pdf_id`, status → `ACCEPTED`
5. **Commit** (transakcja 1 — nowy stan zatwierdzony)
6. Planuje `DocumentProcessingService.process` jako background task dla nowych załączników
7. **Best-effort cleanup**: usuwa stare draft pliki z S3 i DB (błędy logowane, nie przery-wają przepływu)

**Kolejność operacji jest krytyczna:** commit nowego stanu PRZED usunięciem starych draftów zapewnia spójność przy awariach.

---

## Widoczność dokumentów

### Asystent AI (`GET /api/v1/documents/?exclude_draft=true`)

Filtruje `ocr_status != 'skipped'`. Wyświetla status indeksowania:

| `ocr_status` | UI |
|-------------|-----|
| `skipped` | ❌ ukryty |
| `pending` / `processing` / `null` | 🔄 spinner "indeksowanie..." |
| `done` | ✅ gotowy do RAG |
| `failed` | ⚠️ "błąd indeksowania" — pobieranie możliwe |

### Zakładka Dokumenty (profil klienta / umowa)

Bez filtrów — pokazuje wszystkie załączniki. Generacje w statusie `preview`/`draft` pokazują badge **WERSJA ROBOCZA** obok przycisków PDF.

---

## RAG Search

`DocumentChunkRepository.search` szuka po `customer_id` w chunksach. Drafty mają `ocr_status = 'skipped'` i nigdy nie są przetwarzane przez `DocumentProcessingService`, więc nie mają chunksów → nie pojawiają się w wynikach wyszukiwania.

---

## `_upload_pdf` helper

Parametr `ocr_status` (domyślnie `SKIPPED`):
- `finalize` → `SKIPPED` (draft, nie do indeksowania)
- `accept` → `PENDING` (czysty, czeka na indeksowanie)

---

## Diagram stanu załącznika

```
finalize()
  → Attachment(ocr_status=SKIPPED)   ← widoczny: DocumentsTab z badge
                                       niewidoczny: AdvisorPage

accept()
  → stary Attachment → DELETE
  → nowy Attachment(ocr_status=PENDING) → background task
                                    → ocr_status=DONE
                                       widoczny: AdvisorPage (normalnie)
                       → błąd background task
                                    → ocr_status=FAILED
                                       widoczny: AdvisorPage (⚠ błąd)
```
