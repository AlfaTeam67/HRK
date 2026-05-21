# AI Summary klienta — streaming + cache

## Cel

Wygenerować zwięzłe (3-4 zdania) podsumowanie klienta dla opiekuna —
skrót aktywnych umów, ostatnich notatek i otwartych alertów. Wynik jest
streamowany do UI (SSE) i cache'owany na 1 godzinę.

---

## Endpoint

```
POST /api/v1/customers/{customer_id}/ai-summary
GET  /api/v1/customers/{customer_id}/ai-summary/stream      ← SSE
```

`POST` — wynik blokujący (`AiSummaryResponse { summary, generated_at }`).
`GET stream` — SSE (`text/event-stream`):

```
data: {"token": "Klient "}\n\n
data: {"token": "Empik "}\n\n
...
data: {"done": true, "generated_at": "2026-05-21T10:00:00+00:00"}\n\n
```

---

## Cache

`app/service/ai_summary.py`:

```python
_CACHE_TTL = timedelta(hours=1)
_cache: dict[uuid.UUID, tuple[str, datetime]] = {}
```

- Cache **w pamięci procesu** (in-memory). Klucz: `customer_id`.
- TTL 1 godzina. Przy expired → re-generate.
- `service.invalidate(customer_id)` — invalidacja ręczna (np. po
  zmianie statusu klienta — TODO: podpiąć do mutacji).

> W trybie multi-worker (gunicorn z >1 workerów) cache jest per-worker.
> Dla MVP wystarczy. Docelowo: Redis.

---

## Prompt

Builder w `_build_prompt(customer, contracts, notes, alerts)`:

```
Klient: {company_name}, segment: {segment}, status: {status}

Aktywne umowy:
- ABC/2024/01 (ramowa), status: active, kończy się: 2026-12-31
- ABC/2024/02 (SLA),    status: active, kończy się: brak daty końca

Ostatnie aktywności:
- [meeting] Spotkanie kwartalne, omówienie planów na Q3...
- [email] Klient zgłosił pytanie o waloryzację...

Aktywne alerty:
- Umowa ABC/2024/01 wygasa za 60 dni
```

System prompt:
```
Jesteś analitykiem CRM. Na podstawie podanych danych o kliencie wygeneruj
krótkie podsumowanie (3-4 zdania) w języku polskim.
Odpowiedz wyłącznie treścią podsumowania, bez nagłówków ani list.
```

Dane wejściowe:
- Klient (z relacją do `Company`).
- **Aktywne** umowy (`status != TERMINATED`, `deleted_at IS NULL`).
- 5 najnowszych notatek (`Note`).
- Otwarte alerty (`AlertStatus.OPEN`) — pole `message`.

---

## Stream

`stream(customer_id)` używa `LLMService.stream_summarize`, który robi
SSE-style stream do OpenRouter (`stream: True`):

```python
async with client.stream("POST", url, json={..., "stream": True}) as response:
    async for line in response.aiter_lines():
        if line.startswith("data: "):
            data = line[6:]
            if data == "[DONE]":
                break
            chunk = json.loads(data)
            delta = chunk["choices"][0]["delta"].get("content", "")
            if delta:
                yield delta
```

Tokeny zbieramy też do `chunks: list[str]`, żeby po skończonym streamie
zapisać wynik do cache.

---

## Frontend

`AdvisorPage` / `ClientsPage` (zakładka AI Summary):

```ts
const es = new EventSource(`${env.apiUrl}/api/v1/customers/${id}/ai-summary/stream`)
es.onmessage = (event) => {
  const payload = JSON.parse(event.data)
  if (payload.token) setText((t) => t + payload.token)
  if (payload.done)  { setGeneratedAt(payload.generated_at); es.close() }
  if (payload.error) { setError(payload.error); es.close() }
}
```

Gdy backend ma wynik z cache, wysyła go jako jeden duży token + `done`.

---

## Rate limit OpenRouter (429)

Gdy OpenRouter zwróci 429:

```python
return "Model jest chwilowo przeciążony (rate limit). Spróbuj ponownie za chwilę."
```

UI dostaje tę treść jako odpowiedź (ale cache nie jest zapisywany — to
jest ważne, żeby retry był możliwy).

---

## Antywzorce

- ❌ Wywoływanie `ai-summary` na liście klientów (N+1) — używaj jako
  „on demand" w detalu klienta.
- ❌ Ignorowanie cache w testach end-to-end → wyniki pływają. W testach
  wyczyść `_cache` przez `service.invalidate(...)`.
- ❌ Trzymanie cache w Redux po stronie frontu — backend już cachuje.
