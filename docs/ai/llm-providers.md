# LLM providery — OpenRouter ↔ Ollama

## Cel

Pokazać, jak przełączać HRK CRM między **OpenRouter** (chmura, Gemma 4)
a **lokalną Ollamą** (offline). Embeddingi zawsze idą przez Ollamę
(`nomic-embed-text`), to dotyczy wyłącznie LLM-a.

---

## Pluggable klient LLM

`LLMService` (`app/service/llm.py`) używa **OpenAI-compatible API**:

```python
async with httpx.AsyncClient(timeout=60.0) as client:
    response = await client.post(
        f"{settings.openrouter_base_url}/chat/completions",
        headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
        json={"model": settings.openrouter_model, "messages": [...]},
    )
```

Trzy zmienne sterują providerem:

```env
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_API_KEY=<key>
OPENROUTER_MODEL=google/gemma-4-31b-it:free
```

---

## Setup A — OpenRouter (domyślny)

1. Zarejestruj klucz na https://openrouter.ai/keys.
2. Wybierz model — sensowne darmowe / tanie:
   - `google/gemma-4-31b-it:free` — domyślny.
   - `google/gemma-4-9b-it:free` — szybszy, słabszy.
   - `meta-llama/llama-4-8b-instruct:free` — alternatywa.
3. W `backend/.env`:
   ```env
   OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
   OPENROUTER_API_KEY=sk-or-v1-...
   OPENROUTER_MODEL=google/gemma-4-31b-it:free
   ```

Plusy: brak GPU, działa od razu, łatwe demo.
Minusy: rate limity, internet wymagany, dane lecą do chmury.

---

## Setup B — lokalna Ollama (offline)

Ollama wystawia kompatybilne API pod `/v1/chat/completions`. Wystarczy
podmienić bazę URL i klucz na cokolwiek:

```env
OPENROUTER_BASE_URL=http://localhost:11434/v1
OPENROUTER_API_KEY=ollama
OPENROUTER_MODEL=gemma3:4b
```

(W Dockerze: `http://ollama:11434/v1`.)

### Instalacja modelu

```bash
docker exec hrk-ollama ollama pull gemma3:4b
# lub większy model:
docker exec hrk-ollama ollama pull gemma2:27b   # ~16 GB RAM
```

### Lokalne wymogi sprzętowe

| Model         | RAM (CPU) | GPU VRAM | Notes |
|---------------|-----------|----------|-------|
| `gemma3:4b`   | 8 GB      | 4-6 GB   | Starczające do retrieval Q&A. |
| `gemma2:9b`   | 16 GB     | 8-12 GB  | Lepsza jakość, sensowna jakość pism PL. |
| `gemma2:27b`  | 32 GB     | 16+ GB   | Demo do prezentacji. |

Plusy: brak rate limitów, dane zostają lokalnie, deterministycznie.
Minusy: wymaga GPU/zasobów, wolniejsze na CPU.

---

## Embeddingi — zawsze Ollama

`EmbeddingService` używa `OLLAMA_URL` (osobnego od OpenRouter) i modelu
`nomic-embed-text`:

```env
OLLAMA_URL=http://ollama:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
```

Pull modelu (raz):
```bash
docker exec hrk-ollama ollama pull nomic-embed-text
```

> **OpenRouter nie wystawia embeddingów**, dlatego embed jest oddzielną
> integracją niezależną od LLM-a.

---

## Reranker

`services/reranker/` (FlashRank) — niezależny od OpenRouter / Ollamy.
Używa lokalnych modeli reranking (np. `ms-marco-TinyBERT`).

```env
RERANKER_URL=http://reranker:8003
```

---

## Bezpieczeństwo + dane

| Komponent | Co dostaje | Komentarz |
|---|---|---|
| OpenRouter | Treść chunków klienta + pytanie | Dane mogą być widoczne dostawcy chmury. |
| Ollama lokalna | To samo | Dane zostają w infrastrukturze HRK. |
| FlashRank (reranker) | Treść chunków + query | Lokalny kontener, brak wycieku. |

Decyzja **chmura vs lokal** jest biznesowa. Dla wrażliwych danych
(NDA, PII) → Ollama lokalna.

---

## Dalej

- [`rag.md`](rag.md) — pipeline retrieval + reranking + LLM.
- [`document-generation.md`](document-generation.md) — generowanie
  pism (cover letter, rationale).
- [`../operations/runbook.md`](../operations/runbook.md) — jak
  uruchomić Ollamę / podmienić providera.
