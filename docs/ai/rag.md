# AI / RAG — wyszukiwanie dokumentów

## Cel

Pełny opis pipeline'u **Retrieval-Augmented Generation** w HRK CRM:
od wgrania PDF, przez chunking + embedding, po wyszukiwanie w
Asystencie AI (`/assistant`).

> Plik łączy się z [`../workflows/document-upload.md`](../workflows/document-upload.md)
> (upload + indeksowanie) oraz [`../data-model/jsonb-and-pgvector.md`](../data-model/jsonb-and-pgvector.md)
> (techniczne aspekty pgvector).

---

## Dwa flow

```
                         ┌────────────────────────────────────────────┐
                         │  UPLOAD (asynchroniczny — BackgroundTasks) │
                         └────────────────────────────────────────────┘
upload PDF
  → S3 (zapis)
  → INSERT attachments (ocr_status=pending)
  → BackgroundTask:
       pdfplumber.extract_text() → paragraphs (z OCR fallback dla skanów)
       chunker (≈400 tokenów, overlap 80, granice paragrafów)
       EmbeddingService.embed_batch() → wektory 768
       INSERT document_chunks (bulk)
       UPDATE attachments SET ocr_status='done'

                         ┌────────────────────────────────────────────┐
                         │  SEARCH (synchroniczny, online)            │
                         └────────────────────────────────────────────┘
POST /api/v1/rag/search { customer_id, query, ai_mode, top_k }
  → EmbeddingService.embed(query) → wektor 768
  → SQL: WHERE customer_id=:cid AND embedding<=>:vec < 0.35  ORDER BY <=>  LIMIT 4*top_k
  → RerankerClient.rerank(query, candidates, top_k)
       (fallback do score wektorowego, jeśli reranker padł)
  → optional: LLMService.generate(query, context_chunks)  (gdy ai_mode=true)
  → return chunks + ai_answer
```

---

## Komponenty

### `EmbeddingService` (`app/service/embedding.py`)

```python
class EmbeddingService:
    async def embed(self, text: str) -> list[float]:
        ...
    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        # POST {OLLAMA_URL}/api/embed  body: { model, input: [...] }
```

- Model: `nomic-embed-text` (Ollama). Wektor 768 floatów.
- Timeout 120 s — embed wsadowy może być długi.
- Klient HTTP: `httpx.AsyncClient`.

### Chunker (`app/service/document_processing.py`)

Stałe:
```
CHUNK_SIZE     = 1600 znaków  ≈ 400 tokenów
CHUNK_OVERLAP  = 320 znaków   ≈ 80 tokenów
```

Logika:
1. **Wyciąg paragrafów** per strona (pdfplumber `extract_text()` →
   split po `\n\n`).
2. **Fallback OCR**: jeśli strona pusta, render do obrazu
   (`pdf2image.convert_from_bytes`) i OCR (`pytesseract`,
   `lang="pol+eng"`).
3. **Łączenie paragrafów** w chunki do `CHUNK_SIZE`. Granica strony —
   wymuszona (chunk nie spina dwóch stron).
4. **Overlap** — przy nowym chunku z tej samej strony zachowujemy
   ostatnich `CHUNK_OVERLAP` znaków.

Kazdy chunk niesie:
```python
{ "content": str, "page_number": int | None }
```

### `DocumentChunkRepository.search` (`app/repo/document_chunk.py`)

SQL (skrót):
```sql
SELECT id, attachment_id, customer_id, chunk_index, content,
       page_number, bbox, section_title,
       embedding <=> :vec AS vec_score
FROM document_chunks
WHERE customer_id = :cid
  AND embedding <=> :vec < :max_distance
ORDER BY vec_score
LIMIT :top_k;
```

- `max_distance` = `settings.rag_vec_max_distance` (default **0.35**).
- Pre-filter po `customer_id` jest **kluczowy** — bez niego HNSW
  przeszukałby wszystkich klientów.
- Operator `<=>` = cosine distance (mniejsze = bardziej podobne).

### `RerankerClient` (`app/service/reranker_client.py`)

```python
async def rerank(self, query: str, chunks: list[ChunkResult], top_k: int):
    documents = [{"id": str(c.chunk_id), "text": c.content} for c in chunks]
    try:
        response = await client.post(f"{RERANKER_URL}/api/rerank",
                                     json={"query": query, "documents": documents})
        results = response.json()  # [{ "id", "score" }, ...]
    except httpx.HTTPError:
        # Fallback: zostań przy score'ach wektorowych
        chunks.sort(key=lambda c: c.score)
        return chunks[:top_k]
    score_map = {res["id"]: res["score"] for res in results}
    for chunk in chunks:
        chunk.score = score_map.get(str(chunk.chunk_id), chunk.score)
    chunks.sort(key=lambda c: c.score, reverse=True)
    return chunks[:top_k]
```

Mikroserwis: `services/reranker/` (FlashRank, port 8003).

> Reranker jest **opcjonalny**. Padnięcie kontenera nie wywala
> wyszukiwania, tylko obniża jakość rankingu.

### `LLMService` (`app/service/llm.py`)

```python
async def generate(self, query: str, context_chunks: list[str]) -> str:
    context = "\n\n".join(f"[{i+1}] {c}" for i, c in enumerate(context_chunks))
    response = await client.post(f"{OPENROUTER_BASE_URL}/chat/completions",
        json={
            "model": OPENROUTER_MODEL,
            "messages": [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": f"Kontekst:\n{context}\n\nPytanie: {query}"},
            ],
        },
        headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"})
```

System prompt:
```
Jesteś asystentem CRM analizującym dokumenty klientów.
Odpowiadaj wyłącznie na podstawie podanego kontekstu.
Jeśli odpowiedź nie wynika z kontekstu, powiedz to wprost.
```

Domyślny model: `google/gemma-4-31b-it:free` (OpenRouter).
Można przerzucić na lokalną Ollamę — zob. [`llm-providers.md`](llm-providers.md).

### `RAGService` (`app/service/rag.py`)

```python
async def search(self, req: RagSearchRequest, db: AsyncSession) -> RagSearchResponse:
    query_embedding = await self._embed.embed(req.query)
    repo = DocumentChunkRepository(db)
    fetch_k = max(40, req.top_k * 4)        # więcej kandydatów do reranku
    results = await repo.search(
        customer_id=req.customer_id,
        embedding=query_embedding,
        query_text=req.query,
        top_k=fetch_k,
        max_distance=settings.rag_vec_max_distance,
    )

    chunks = [
        ChunkResult(
            chunk_id=c.id, attachment_id=c.attachment_id, content=c.content,
            highlight=_best_sentence(req.query, c.content),
            page_number=c.page_number, bbox=c.bbox, section_title=c.section_title,
            score=score,
            similarity=max(0.0, 1.0 - float(c.vec_score)),
        ) for c, score in results
    ]

    if chunks:
        chunks = await self._reranker.rerank(req.query, chunks, req.top_k)

    ai_answer = None
    if req.ai_mode and chunks:
        ai_answer = await self._llm.generate(req.query, [c.content for c in chunks])

    return RagSearchResponse(chunks=chunks, ai_answer=ai_answer,
                             no_results_found=not bool(chunks))
```

`_best_sentence(query, content)` — prosty extractor zdania pasującego
do query (po overlap słów). Filtruje stopwordy. Używany do
*highlightu* na froncie.

---

## Schemat danych

Tabela `document_chunks` ma kolumny:
- `embedding: Vector(768)` (pgvector)
- `customer_id` — denormalizowany pre-filter
- `page_number`, `bbox` — do podświetlania w PDF
- `section_title` — kontekst dla LLM (puste w MVP — TODO: parsowanie
  nagłówków).

Indeks HNSW:
```python
Index("idx_chunks_embedding_hnsw", "embedding",
      postgresql_using="hnsw",
      postgresql_ops={"embedding": "vector_cosine_ops"},
      postgresql_with={"m": 16, "ef_construction": 64})
```

Zob. [`../data-model/entities.md`](../data-model/entities.md) → `document_chunks`.

---

## Tryby

### 1. Pure retrieval (`ai_mode=false`)
- Czas: **~200 ms**.
- Brak LLM w pipeline.
- Idealne do pytań typu „Kiedy kończy się umowa?", „Jaka stawka za X?".
- Frontend pokazuje listę chunków + highlighty w PDF.

### 2. AI mode (`ai_mode=true`)
- Czas: **3–10 s** (zależy od modelu).
- LLM na bazie top-k chunków buduje odpowiedź narracyjną.
- Idealne do pytań typu „Czy możemy wypowiedzieć bez kary?",
  „Porównaj warunki płatności w 3 umowach", „Jakie ryzyka niesie ta
  umowa?".
- Halucynacje? Promp wymusza odpowiedź **wyłącznie** z kontekstu.

UI: switch w lewym górnym rogu chatu (`AdvisorPage`).

---

## Drafty AI generation a RAG

`Attachment` z `ocr_status='skipped'` **nigdy** nie jest chunkowany.
W praktyce dotyczy to draftów wygenerowanych przez `DocumentGenerationService`:

- `finalize()` → `Attachment(ocr_status=skipped)` → niewidoczne w RAG.
- `accept()` → nowy `Attachment(ocr_status=pending)` → kolejka chunków
  → po przetworzeniu widoczne w RAG.

Filtr w UI Asystenta: `GET /api/v1/documents?exclude_draft=true` →
`ocr_status != 'skipped'`.

Zob. [`document-generation.md`](document-generation.md).

---

## Tuning i ograniczenia

| Parametr | Wartość | Wpływ |
|---|---|---|
| `CHUNK_SIZE` | 1600 zn. | Większe = mniej chunków, ale tracimy granularność. |
| `CHUNK_OVERLAP` | 320 zn. | Zapobiega ucięciu kontekstu na granicy. |
| `top_k` (request) | default 5 | Ile chunków zwraca API. |
| `fetch_k` | `max(40, top_k*4)` | Kandydaci do rerankera. |
| `rag_vec_max_distance` | 0.35 | Cosine distance threshold. Mniejsze = bardziej restrykcyjne. |
| HNSW `m` | 16 | Połączenia per node. Większe = lepsza precyzja, dłuższy build. |
| HNSW `ef_construction` | 64 | Kandydaci podczas budowania. Większe = lepsza, dłuższy build. |
| Pre-filter `customer_id` | zawsze | KRYTYCZNE dla privacy + perf. |

---

## Dalej

- [`document-generation.md`](document-generation.md) — generowanie
  aneksów/pism z AI.
- [`ai-summary.md`](ai-summary.md) — streaming AI summary klienta.
- [`llm-providers.md`](llm-providers.md) — OpenRouter ↔ lokalna Ollama.
- [`../workflows/document-upload.md`](../workflows/document-upload.md) —
  szczegółowy flow uploadu.
