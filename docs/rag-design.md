# RAG — Document Search Design

## Cel

Przeszukiwanie dokumentów klienta (umowy, aneksy, notatki ze spotkań) przez chat po lewej stronie widoku klienta. Odpowiedź zawiera podświetlony fragment w PDF i wskazanie źródłowego dokumentu.

---

## Flow — wgrywanie dokumentu

```
Upload PDF
  → zapis w S3
  → rekord w attachments (ocr_status = 'pending')
  → FastAPI BackgroundTasks (odpowiedź wraca do użytkownika natychmiast)
      → pdfplumber.extract_words() — tekst + pozycje słów na stronie
      → podział na chunki (~400 tokenów, overlap 80, granice paragrafów)
      → każdy chunk: { content, page_number, bbox, chunk_index }
      → HTTP POST ollama:11434/api/embeddings → nomic-embed-text → wektor 768 dim
      → INSERT INTO document_chunks (content, page_number, bbox, embedding, customer_id, ...)
      → UPDATE attachments SET ocr_status = 'done'
```

Notatki ze spotkań (Note) — ten sam flow bez bbox/page_number (tekst plain).

> MVP: FastAPI `BackgroundTasks`. Migracja do Celery gdy pojawi się potrzeba retries, monitoringu lub wielu workerów.

---

## Flow — odpowiedź na pytanie

### Tryb domyślny: pure retrieval

```
Pytanie użytkownika w kontekście klienta (np. Empik)
  → HTTP POST ollama:11434/api/embeddings → embed pytania
  → SELECT top-5 chunków WHERE customer_id = X ORDER BY embedding <=> pytanie_embedding
  → zwróć użytkownikowi:
      - podświetlony fragment w PDF (page_number + bbox)
      - nazwa dokumentu + link do S3
      - treść chunku
```

Czas odpowiedzi: ~200ms. Brak LLM w ścieżce.

### Tryb AI: interpretacja (switch włączony)

```
Te same top-5 chunki
  → HTTP POST ollama:11434/api/generate (Gemma)
      prompt: kontekst chunków + pytanie użytkownika
  → odpowiedź tekstowa z cytowanymi chunk_id
  → frontend podświetla cytowane fragmenty w PDF
```

Czas odpowiedzi: 3–10s (lokalny LLM).

---

## Tryb AI — switch, nie przycisk

Użytkownik ma **przełącznik "Tryb AI"** w panelu chatu. Gdy włączony — każde pytanie przechodzi przez Gemma zamiast zwracać surowe fragmenty.

```
┌─────────────────────────────────┐
│  Wyszukaj w dokumentach         │
│  ○──────────────● Tryb AI  🤖   │  ← switch
│                                 │
│  [ Kiedy kończy się umowa? ]    │
└─────────────────────────────────┘
```

**Dlaczego switch, nie automat i nie jednorazowy przycisk:**

- Użytkownik świadomie przechodzi w tryb "rozmawiania z AI" — inne oczekiwania UX
- Nie trzeba decydować per-pytanie; switch ustawia kontekst sesji
- Przy wyłączonym switchu: deterministyczne wyniki, zero halucynacji, ~200ms
- Przy włączonym: użytkownik akceptuje wolniejszą odpowiedź i syntezę

**Kiedy switch ma sens:**

| Pytanie                                | Tryb                       |
| -------------------------------------- | -------------------------- |
| Kiedy kończy się umowa?                | domyślny (retrieval)       |
| Jaka stawka za usługę X?               | domyślny (retrieval)       |
| Czy możemy wypowiedzieć bez kary?      | AI (interpretacja klauzul) |
| Porównaj warunki płatności w 3 umowach | AI (synteza wielu chunków) |
| Jakie ryzyka niesie ta umowa?          | AI (rozumowanie)           |
| Podsumuj notatki ze spotkań z Q1       | AI (agregacja)             |

---

## Infrastruktura — ollama jako osobny serwis Docker

```yaml
# docker-compose.yml
services:
  ollama:
    image: ollama/ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama # modele persystują między restartami

volumes:
  ollama_data:
```

Modele pobieramy raz:

```bash
docker exec ollama ollama pull nomic-embed-text
docker exec ollama ollama pull gemma 4
```

https://huggingface.co/google/gemma-4-26B-A4B-it - dla mocniejszych sprzętów (M2/M4 ale musi byc 16GB RAM i zajmie 15GB)

https://huggingface.co/google/gemma-4-E4B-it - dla słabszych (GTX 1060 6GB)

FastAPI odpytuje przez HTTP — model jest załadowany w pamięci cały czas, każde zapytanie to ~10ms overhead zamiast ładowania modelu od zera.

---

## Schemat bazy (document_chunks)

Kolumny wymagane dodatkowo względem obecnego PR:

| Kolumna         | Typ           | Po co                                     |
| --------------- | ------------- | ----------------------------------------- |
| `embedding`     | `vector(768)` | samo serce RAG                            |
| `page_number`   | `int`         | podświetlanie w PDF                       |
| `bbox`          | `jsonb`       | prostokąt na stronie `{x0,y0,x1,y1}`      |
| `customer_id`   | `uuid FK`     | pre-filter przed wyszukiwaniem wektorowym |
| `section_title` | `text`        | kontekst dla LLM, poprawia retrieval      |

Indeks:

```sql
CREATE INDEX ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

---

## Stack

| Komponent        | Technologia                                          |
| ---------------- | ---------------------------------------------------- |
| Embedding model  | `nomic-embed-text` przez ollama (Docker, port 11434) |
| LLM (tryb AI)    | `gemma4` przez ollama (ten sam serwis)               |
| Vector DB        | pgvector (istniejący PostgreSQL)                     |
| PDF parsing      | pdfplumber                                           |
| Async processing | FastAPI `BackgroundTasks` (MVP)                      |
| Storage          | S3                                                   |
