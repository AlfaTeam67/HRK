# Flow — tworzenie dokumentu (upload → chunking → embeddings)

## Skrót

```
POST /api/v1/documents/upload
  → S3 (zapis bajtów)
  → INSERT attachments (ocr_status = 'pending')
  → BackgroundTask uruchomiony (odpowiedź HTTP wraca do klienta natychmiast)
      → pdfplumber: wyciąg tekstu + pozycje słów
      → chunker: podział tekstu na kawałki
      → EmbeddingService: embed każdego chunku (ollama)
      → INSERT document_chunks (chunk × N wierszy)
      → UPDATE attachments SET ocr_status = 'done'
```

---

## Etap 1 — HTTP upload (synchroniczny)

Endpoint: `POST /api/v1/documents/upload` (`DocumentService.upload_document`)

```
klient → FastAPI router → DocumentService
```

Co się dzieje:
1. Walidacja pliku (rozmiar, MIME type)
2. Zapis bajtów pliku do S3: `s3_key = customers/{customer_id}/{uuid}.pdf`
3. `INSERT INTO attachments`:
   - `customer_id` — UUID klienta (pre-filter dla RAG)
   - `s3_bucket`, `s3_key` — lokalizacja w MinIO
   - `original_filename`, `mime_type`, `file_size_bytes`
   - `document_type` — enum: `contract`, `amendment`, `DPA`, ...
   - `ocr_status = 'pending'` — znacznik że chunking jeszcze nie był
4. `background_tasks.add_task(process_document, attachment.id, content)` — rejestracja zadania
5. **HTTP 201 wraca do klienta** — BackgroundTask startuje po wysłaniu odpowiedzi

Model `Attachment` (tabela `attachments`):
```
id            UUID PK
customer_id   UUID FK → customers
contract_id   UUID FK → contracts (opcjonalnie)
document_type enum
s3_bucket     str
s3_key        str (unikalny)
ocr_status    enum: pending | processing | done | failed | skipped
extracted_text text (opcjonalnie, po pdfplumber)
```

---

## Etap 2 — Background processing (asynchroniczny)

Klasa: `DocumentProcessingService.process(attachment_id, content)`

### 2a. Wyciąg tekstu (pdfplumber)

```python
with pdfplumber.open(io.BytesIO(content)) as pdf:
    for page in pdf.pages:
        words = page.extract_words()
        # każde słowo ma: text, x0, y0, x1, y1, page_number
```

Rezultat: lista słów z pozycjami → używamy do budowania chunków z `page_number` i `bbox`.

### 2b. Podział na chunki (chunker)

Parametry:
- `chunk_size = 400 tokenów` (~1600–2000 znaków)
- `chunk_overlap = 80 tokenów` (zapobiega ucięciu kontekstu na granicy)
- granice: paragraf (`\n\n`) → zdanie → twarde cięcie

Każdy chunk:
```python
{
    "attachment_id": UUID,
    "customer_id": UUID,
    "chunk_index": int,       # 0, 1, 2, ...
    "content": str,           # tekst fragmentu
    "token_count": int,
    "page_number": int | None,
    "bbox": {"x0": float, "y0": float, "x1": float, "y1": float} | None,
    "section_title": str | None,
}
```

### 2c. Embedding każdego chunku

```python
embedding: list[float] = await EmbeddingService.embed(chunk["content"])
# → POST ollama:11434/api/embeddings
# → model: nomic-embed-text
# → wektor 768 floatów
```

### 2d. Zapis do bazy

```python
await DocumentChunkRepository.bulk_insert(chunks_with_embeddings)
# → INSERT INTO document_chunks (N wierszy naraz)
```

Model `DocumentChunk` (tabela `document_chunks`):
```
id             UUID PK
attachment_id  UUID FK → attachments (CASCADE DELETE)
customer_id    UUID FK → customers   (pre-filter dla wyszukiwania)
chunk_index    int      (unikalny per attachment)
content        text
token_count    int
page_number    int | None
bbox           jsonb | None   → {x0, y0, x1, y1}
section_title  str | None
embedding      vector(768)    ← pgvector, HNSW index
```

### 2e. Aktualizacja statusu

```python
attachment.ocr_status = OcrStatus.DONE
await db.commit()
```

Stany `ocr_status`:
| Stan         | Znaczenie                                      |
|--------------|------------------------------------------------|
| `pending`    | tuż po upload, chunking jeszcze nie startował  |
| `processing` | chunking w toku                                |
| `done`       | chunki w DB, dokument gotowy do RAG            |
| `failed`     | błąd podczas pdfplumber lub embeddingu         |
| `skipped`    | plik nie jest PDF (np. obraz bez OCR)          |

---

## Etap 3 — Wyszukiwanie (RAG search)

Endpoint: `POST /api/v1/rag/search`

```python
# request body
{
  "customer_id": UUID,
  "query": str,
  "ai_mode": bool,   # false = czyste retrieval, true = odpowiedź przez LLM
  "top_k": int       # 1–20, default 5
}
```

Flow:
1. `EmbeddingService.embed(query)` → wektor zapytania
2. `DocumentChunkRepository.search(customer_id, embedding, top_k)`:
   ```sql
   SELECT *, embedding <=> :query_vec AS score
   FROM document_chunks
   WHERE customer_id = :customer_id
   ORDER BY score
   LIMIT :top_k
   ```
   Operator `<=>` = cosine distance (pgvector). HNSW index przyspiesza do ~5–20ms.
3. **Tryb domyślny** (`ai_mode=false`): zwróć chunki + score. Czas: ~200ms.
4. **Tryb AI** (`ai_mode=true`): chunki → `LLMService.generate(query, chunks)` → OpenRouter (Gemma). Czas: 3–10s.

---

## Diagram zależności między klasami

```
POST /documents/upload
  └── DocumentService
        ├── StorageService          → S3 (MinIO)
        ├── AttachmentRepository    → INSERT attachments
        └── BackgroundTask
              └── DocumentProcessingService
                    ├── StorageService          → GET z S3 (bajty pliku)
                    ├── pdfplumber              → tekst + bbox
                    ├── EmbeddingService        → ollama HTTP
                    └── DocumentChunkRepository → INSERT document_chunks

POST /rag/search
  └── RAGService
        ├── EmbeddingService        → ollama HTTP
        ├── DocumentChunkRepository → vector search
        └── LLMService              → OpenRouter HTTP (opcjonalnie)
```

---

## Ważne szczegóły implementacyjne

- **`customer_id` w `document_chunks`** — denormalizacja celowa: pre-filter `WHERE customer_id = X` przed wyszukiwaniem wektorowym. Bez tego HNSW musiałby przeszukać wszystkie chunki wszystkich klientów.
- **BackgroundTask vs Celery** — MVP używa FastAPI `BackgroundTasks` (ten sam proces, bez kolejki). Wystarczające gdy pliki są małe i czas ~10s jest akceptowalny. Migracja do Celery gdy potrzebne: retry, monitoring, wielu workerów.
- **Compensation pattern** — jeśli S3 upload się powiedzie ale INSERT do DB nie, rollback usuwa plik z S3 (implementacja w `DocumentService`).
- **CASCADE DELETE** — usunięcie `Attachment` kaskadowo usuwa wszystkie jego `DocumentChunk` (zdefiniowane w ORM: `cascade="all, delete-orphan"`).
- **Punkt integracji** — `DocumentService.upload_document()` musi wywołać `background_tasks.add_task(...)` po commicie do DB, nie przed.
