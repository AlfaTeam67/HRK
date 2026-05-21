# JSONB i pgvector — wzorce użycia

## Cel

Wyjaśnić, **kiedy używać JSONB**, a kiedy zwykłej kolumny, oraz jak
działa wektorowe wyszukiwanie (pgvector). Dwa narzędzia, które robią
HRK CRM elastycznym, ale łatwo z nimi nadużywać.

---

## JSONB — kiedy ma sens, kiedy nie

### ✅ Dobre zastosowania
- **`additional_data`** — pola luźne, integracyjne, rzadko query'owane
  (np. metadane z innego systemu, pomocnicze flagi UI).
- **`audit_logs.old_values / new_values`** — dynamiczne diffy.
- **`document_generations.payload / simulation / ai_artifacts`** —
  snapshot inputów/outputów, którego struktura zmienia się w czasie
  i nie chcemy migrować schematu przy każdej zmianie.

### ❌ Złe zastosowania
- Dane, po których filtrujesz w 90% zapytań (zamiast tego: kolumna).
- Statusy, daty, pieniądze (one są semantycznie kolumnami).
- Identyfikatory referencyjne (powinny być FK).

### Reguła kciuka

> Jeśli przez większą część czasu robisz `WHERE additional_data->>'key' = ...`,
> to znaczy że to powinna być pełnoprawna kolumna.

---

## Domyślne wartości JSONB

```python
additional_data: Mapped[dict] = mapped_column(
    JSONB, server_default=text("'{}'::jsonb"), nullable=False
)
```

- `nullable=False` + `server_default '{}'` = **zawsze masz dict**, nigdy
  `None`. To eliminuje stertę `if obj.additional_data is not None:` w kodzie.
- W Pydantic schemacie: `dict[str, Any]` z `default_factory=dict`.

---

## Indeksy JSONB

Jeśli musisz query'ować po jakimś polu w JSONB:

### Indeks na pojedyncze klucze (BTREE expression)
```sql
CREATE INDEX idx_customers_segment_extra
  ON customers ((additional_data ->> 'priority'));
```

### Pełny GIN
```sql
CREATE INDEX idx_customers_additional_data_gin
  ON customers USING GIN (additional_data);
```

GIN jest dobry dla "czy klucz X istnieje", "czy klucz X = wartość Y".
Dla "czy fragment tekstu pasuje" — to inna historia (pgvector lub tsvector).

> Aktualnie HRK **nie** ma takich indeksów na `additional_data` — dane
> są małe i query rzadkie. Dodaj świadomie, gdy zaczniesz filtrować
> po polach JSON.

---

## Praca z JSONB w SQLAlchemy

```python
from sqlalchemy.dialects.postgresql import JSONB

# odczyt: zwykły dict
customer.additional_data["priority"]

# zapis: pamiętaj, że to mutable
customer.additional_data = {**customer.additional_data, "priority": "high"}
# (zwykła mutacja może nie zostać wykryta — tworzymy nowy dict)
```

W zapytaniach:
```python
from sqlalchemy import cast, String

stmt = select(Customer).where(
    Customer.additional_data["priority"].astext == "high"
)
```

---

## pgvector — wektorowe wyszukiwanie

Tabela: `document_chunks`. Kolumna: `embedding: Vector(768)`.

### Model
```python
from pgvector.sqlalchemy import Vector

embedding: Mapped[list[float]] = mapped_column(Vector(768), nullable=False)
```

### Index HNSW
```python
Index(
    "idx_chunks_embedding_hnsw",
    "embedding",
    postgresql_using="hnsw",
    postgresql_ops={"embedding": "vector_cosine_ops"},
    postgresql_with={"m": 16, "ef_construction": 64},
)
```

- HNSW (Hierarchical Navigable Small World) — szybki algorytm K-nearest.
- `vector_cosine_ops` — operator `<=>` (cosine distance). Bliżej zera =
  bardziej podobne.
- Parametry tuningowe (`m`, `ef_construction`) — sensowne dla dataset
  ~10k–100k chunków. Większe `m` = lepsza precyzja, dłuższy build.

### Operator
```sql
SELECT *,
       embedding <=> :query_vec AS distance
FROM document_chunks
WHERE customer_id = :cid
  AND embedding <=> :query_vec < 0.35
ORDER BY distance
LIMIT 40;
```

- `<=>` — cosine distance.
- `<->` — L2 (euklidesowa).
- `<#>` — inner product.

W kodzie HRK używamy **cosine** (`vector_cosine_ops`).

### Pre-filter `customer_id`

```sql
WHERE customer_id = :cid
  AND embedding <=> :query_vec < :max_distance
ORDER BY embedding <=> :query_vec
LIMIT :k
```

Pre-filter jest **kluczowy**: bez niego HNSW przeszukałby wszystkich
klientów. PostgreSQL potrafi użyć indeksu B-tree na `customer_id`
do filtrowania, a HNSW dopiero potem.

> Eksperymentalnie: dla pól wymaganych w 99% zapytań (jak `customer_id`)
> denormalizacja w `document_chunks` jest tańsza niż JOIN
> z `attachments` przed sortowaniem wektorowym.

### Pełny pipeline (zob. `app.repo.document_chunk.DocumentChunkRepository.search`)

1. Embed pytania → 768-dim wektor (`EmbeddingService`).
2. SQL z pre-filtrem + cosine + LIMIT k×4 (kandydaci do reranku).
3. Reranker (FlashRank, port 8003) → przesortowany top_k.
4. Opcjonalnie LLM (Gemma) → odpowiedź na podstawie kontekstu.

### Ile razy embed-ować?

- Każdy chunk → embed RAZ przy wgrywaniu dokumentu (`bulk_insert`).
- Każde zapytanie → embed RAZ.
- Reembed całego korpusu robisz tylko, jeśli zmieniasz model embeddingu
  (`OLLAMA_EMBED_MODEL`). Wtedy: drop chunki, re-process attachments,
  reindex.

---

## Bezpieczeństwo / pamięć

- 768 floatów × 4 bajty = **3072 B / chunk**. Dla 100k chunków: ~300 MB
  + index. Mieści się w pamięci RAM przeciętnego serwera.
- HNSW index zajmuje 1.5–3× rozmiar danych.
- Vector(`n`) jest przechowywany jako tablica — narzut SQL minimalny.

---

## Antywzorce

- ❌ Wektory mniejsze niż wymaga model (np. `Vector(384)` przy modelu 768)
  → `RuntimeError` przy zapisie.
- ❌ Query bez pre-filtra `customer_id` → wybierze najlepsze chunki
  z **wszystkich** klientów. Wyciek danych.
- ❌ Próba embed-owania na frontendzie → frontend nie ma dostępu do Ollamy
  i nie powinien.
- ❌ Trzymanie embeddingu w JSONB → tracisz indeks HNSW i typowanie.

---

## Dalej

- [`../ai/rag.md`](../ai/rag.md) — pełny opis pipeline'u RAG.
- [`entities.md`](entities.md) — definicja `document_chunks`.
- [`migrations.md`](migrations.md) — jak dodać kolejny indeks pgvector.
