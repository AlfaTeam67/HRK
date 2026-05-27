# Workflow — upload dokumentu i indeksowanie

## Cel

Pełny przepływ: **wybór pliku w UI → S3 → wpis w DB → background OCR/chunking
→ embedding → wpis w pgvector → widoczność w RAG**.

> Streszczenie + rozwinięcie `docs/document-upload-flow.md`.

---

## TL;DR

```
POST /api/v1/documents (multipart)
   → walidacja MIME / rozmiaru
   → upload do MinIO (private bucket, SSE)
   → INSERT attachments (ocr_status='pending', include_in_ai_assistant=<form>)
   → 201 Created (FE dostaje attachment.id)
   → BackgroundTask (TYLKO gdy include_in_ai_assistant=true i MIME wspierany):
        pdfplumber.extract_text  (OCR fallback dla skanów)
        chunker (~400 tok / overlap 80)
        EmbeddingService.embed_batch  → Ollama nomic-embed-text
        DocumentChunkRepository.bulk_insert
        UPDATE attachments SET ocr_status='done'
```

> Gdy opiekun w `UploadWizard` odznaczy checkbox „Załącz dla asystenta AI",
> attachment zostaje zapisany z `include_in_ai_assistant=false` i
> `ocr_status='skipped'` — żaden background task nie startuje. Można go
> włączyć później przełącznikiem na karcie dokumentu (zob.
> [`../ai/ai-assistant-toggle.md`](../ai/ai-assistant-toggle.md)).

---

## Etap 1 — HTTP upload

`app/api/v1/documents.py`:

```python
@router.post("/", response_model=DocumentRead, status_code=201)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    document_type: DocumentType = Form(DocumentType.OTHER),
    company_id: str | None = Form(None),
    customer_id: str | None = Form(None),
    contract_id: str | None = Form(None),
    uploaded_by: str = Form(...),
    include_in_ai_assistant: bool = Form(True),
    service: DocumentService = Depends(get_document_service),
):
    return await service.upload_document(
        file=file,
        document_type=document_type,
        company_id=parse_uuid(company_id),
        customer_id=parse_uuid(customer_id),
        contract_id=parse_uuid(contract_id),
        uploaded_by=parse_uuid(uploaded_by),
        background_tasks=background_tasks,
        include_in_ai_assistant=include_in_ai_assistant,
    )
```

Reguły:
- Wymagane: jeden z `customer_id` / `contract_id`.
- `uploaded_by` = `user.id` z tabeli `users`.
- `document_type` (enum): `contract` / `amendment` / `power_of_attorney` /
  `DPA` / `PPK` / `report` / `cover_letter` / `other`.

Walidacja w `DocumentService._validate_upload_file`:
- MIME ∈ `{ application/pdf, .doc, .docx, .jpg, .png, .txt }`.
- Rozszerzenie ∈ `{ .pdf, .doc, .docx, .jpg, .jpeg, .png, .txt }`.
- Rozmiar ≤ `DOCUMENT_MAX_FILE_SIZE_BYTES` (10 MB).
- Filename sanitized (regex `[^A-Za-z0-9._-]+`).

---

## Etap 2 — S3 upload

```python
object_key = f"companies/{company_id}/{document_uuid}_{filename}"
await self._storage.upload_bytes(
    key=object_key,
    content=content,
    content_type=content_type,
)
```

- `company_id` resolve z `customer.company_id` jeśli nie podany explicit.
- Klucz `s3_key` jest **UNIQUE** w `attachments` — UUID prepend gwarantuje
  unikalność.

---

## Etap 3 — INSERT do DB + commit

```python
attachment = await self._attachments.create({
    "company_id": resolved_company_id,
    "customer_id": customer.id if customer else None,
    "contract_id": contract.id if contract else None,
    "document_type": document_type,
    "original_filename": original_filename,
    "s3_bucket": settings.s3_bucket,
    "s3_key": object_key,
    "mime_type": content_type,
    "file_size_bytes": len(content),
    "uploaded_by": uploaded_by,
})
await self._session.commit()
await self._session.refresh(attachment)
```

`ocr_status='pending'` (server default).

### Compensation pattern

Jeśli S3 upload się powiedzie **ale INSERT się wywali**, S3 ma osierocony
plik. Cleanup:

```python
except SQLAlchemyError as exc:
    await self._session.rollback()
    try:
        await self._storage.delete_object(key=object_key)
    except StorageServiceError:
        # plik osierocony — log + ręczna interwencja
        logger.exception(...)
    raise DocumentError(...) from exc
```

---

## Etap 4 — BackgroundTask

```python
background_tasks.add_task(
    DocumentProcessingService().process,
    attachment.id,
    attachment.customer_id,
    content,
    content_type,
)
```

**Po** wysłaniu odpowiedzi HTTP do klienta. FastAPI `BackgroundTasks`
działają w pętli requestowej, ale dopiero po commitcie response.

> MVP-tradeoff: brak retry, brak monitoringu kolejki. Migracja do Celery
> gdy: pliki > 50 MB, > 10 uploadów / s, lub potrzebny SLA processingu.

---

## Etap 5 — Processing (`DocumentProcessingService`)

```python
class DocumentProcessingService:
    async def process(self, attachment_id, customer_id, content, mime_type):
        async with AsyncSessionLocal() as session:
            attachments = AttachmentRepository(session)
            chunks_repo = DocumentChunkRepository(session)
            attachment = await attachments.get(attachment_id)

            if mime_type not in _PROCESSABLE:
                attachment.ocr_status = OcrStatus.SKIPPED
                await session.commit()
                return

            attachment.ocr_status = OcrStatus.PROCESSING
            await session.commit()

            try:
                paragraphs = _extract_paragraphs(content, mime_type)
                raw_chunks = _build_chunks(paragraphs)
                if not raw_chunks:
                    attachment.ocr_status = OcrStatus.SKIPPED
                    await session.commit()
                    return

                contents = [c["content"] for c in raw_chunks]
                embeddings = await self._embed.embed_batch(contents)
                chunk_rows = [{
                    "attachment_id": attachment_id,
                    "customer_id": customer_id,
                    "chunk_index": i,
                    "content": chunk["content"],
                    "token_count": len(chunk["content"]) // 4,
                    "page_number": chunk["page_number"],
                    "bbox": None, "section_title": None,
                    "embedding": emb,
                } for i, (chunk, emb) in enumerate(zip(raw_chunks, embeddings))]

                await chunks_repo.bulk_insert(chunk_rows)
                attachment.ocr_status = OcrStatus.DONE
                await session.commit()
            except Exception:
                logger.exception(...)
                attachment.ocr_status = OcrStatus.FAILED
                await session.commit()
```

Sesja DB **nowa** (`AsyncSessionLocal()`) — nie reuse'ujemy
request-scope-d, której już nie ma.

### Wsparcie typów

| MIME              | Strategia |
|-------------------|-----------|
| `application/pdf` | pdfplumber → fallback OCR (pdf2image + pytesseract) |
| `image/jpeg`, `image/png`, ... | OCR od razu (pytesseract `lang=pol+eng`) |
| `text/plain`      | bezpośredni split po `\n\n` |
| Inne (DOCX, ...)  | `OcrStatus.SKIPPED` (TODO: parser DOCX) |

### Chunker

```
CHUNK_SIZE    = 1600 znaków (≈400 tokenów)
CHUNK_OVERLAP = 320 znaków  (≈80 tokenów)
```

Logika łączenia paragrafów + overlap + wymuszony break na granicy strony.
Zob. [`../ai/rag.md`](../ai/rag.md).

### Embedding

```python
embeddings = await self._embed.embed_batch(contents)
# POST {OLLAMA_URL}/api/embed  body: { "model": "nomic-embed-text", "input": [...] }
# → 768-dim float vectors
```

Batch = jedno wywołanie HTTP na cały dokument. Dla 50 chunków: ~2-5 s.

---

## Etap 6 — Widoczność w RAG

Po `ocr_status=done` chunki są dostępne w `document_chunks` i `RAGService.search`
zwraca je dla pytań po danym `customer_id`.

Endpoint `GET /api/v1/documents` ma flagę:
- `exclude_draft=false` (domyślnie) — wszystkie attachments.
- `exclude_draft=true` — pomija `ocr_status='skipped'`. Asystent AI tego
  używa, żeby ukryć drafty AI generation.

---

## Frontend (`UploadWizard`)

`features/documents/UploadWizard.tsx`:

```tsx
const formData = new FormData()
formData.append('file', file)
formData.append('document_type', documentType)
formData.append('customer_id', customerId)
formData.append('uploaded_by', user.id)
formData.append('include_in_ai_assistant', String(includeInAiAssistant))

const { data } = await apiClient.post(
  '/api/v1/documents',
  formData,
  { headers: { 'Content-Type': 'multipart/form-data' } }
)
queryClient.invalidateQueries({ queryKey: ['documents'] })
toast.success('Plik wgrany — indeksowanie w toku')
```

W kroku „Wgraj" UploadWizard pokazuje checkbox **„Załącz dla asystenta AI
(zalecane)"** (domyślnie zaznaczony). Po sukcesie UI pokazuje wiersz z
`OcrStatusBadge` (`pending` → `processing` → `done`) oraz `AiAssistantToggle`
do zmiany stanu w dowolnej chwili. Polling? Tak — TanStack Query
`refetchInterval=3000` gdy są wiersze w `pending|processing`.

> Mikropush przez WebSocket gdy `ocr_status=done` — TODO. Dziś polling
> 3-sekundowy załatwia sprawę dla zwykłych PDF (5-10s indeksacja).

---

## Diagram

```
┌──────────────┐
│ UploadWizard │
└──────┬───────┘
       │ multipart
       ▼
┌─────────────────────────────────────────┐
│ POST /api/v1/documents                  │
│  → DocumentService.upload_document      │
│      → validate file                    │
│      → StorageService.upload_bytes (S3) │
│      → AttachmentRepository.create      │
│      → session.commit                   │
│      → background_tasks.add_task(...)   │
│  → 201 Created                          │
└─────────────────────────────────────────┘
       │
       │ FastAPI flushes response, then runs background task:
       ▼
┌──────────────────────────────────────────────────┐
│ DocumentProcessingService.process(attachment_id) │
│   → ocr_status='processing'                      │
│   → pdfplumber / OCR                             │
│   → _build_chunks                                │
│   → EmbeddingService.embed_batch (Ollama)        │
│   → DocumentChunkRepository.bulk_insert          │
│   → ocr_status='done'                            │
└──────────────────────────────────────────────────┘
                         ▼
                  ┌────────────────┐
                  │ document_chunks│  ← widoczne w RAG
                  └────────────────┘
```

---

## Antywzorce

- ❌ Wywoływanie `process()` synchronicznie w endpoint'cie — request
  trzymałby się 30+ sekund.
- ❌ Trzymanie tej samej sesji DB w background task'u — sesja request-scope
  jest już zamknięta.
- ❌ Pomijanie `customer_id` w `document_chunks` — wyciek w wyszukiwaniu
  per-tenant.
- ❌ `ocr_status` ustawiany ręcznie z UI — to robi serwis processingu.

---

## Dalej

- [`../ai/rag.md`](../ai/rag.md) — co dalej z chunkami w wyszukiwaniu.
- [`../storage/minio.md`](../storage/minio.md) — szczegóły S3.
- Oryginalny: [`/docs/document-upload-flow.md`](../../docs/document-upload-flow.md).
