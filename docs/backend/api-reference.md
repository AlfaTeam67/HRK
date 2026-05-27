# Backend — referencja API

## Cel

Pełna lista endpointów udostępnianych przez backend HRK. Bazą jest
`/api/v1` (zob. `settings.api_v1_str`). Dokument jest źródłem prawdy dla
agentów / programistów. Schematy request/response — patrz `app/schemas/*`.

> W trybie `DEBUG=true` interaktywne dokumenty są dostępne pod
> `http://localhost:8000/docs` (Swagger UI) i `/redoc`.

---

## Konwencje

| Kod | Znaczenie                                                   |
|-----|-------------------------------------------------------------|
| 200 | OK                                                          |
| 201 | Created (POST tworzący zasób)                               |
| 204 | No Content (DELETE / akcje bez ciała)                       |
| 400 | Validation / IntegrityError (np. duplikat unikalnego pola)  |
| 403 | Brak dostępu do dokumentu / zasobu                          |
| 404 | Zasób nie istnieje                                          |
| 422 | Niepoprawne UUID, sprzeczne filtry                          |
| 502 | Problem z zewnętrzną zależnością (S3, AD)                   |

- Wszystkie identyfikatory są **UUID**.
- Daty/dni: ISO-8601 (`2026-05-21`, `2026-05-21T12:00:00+00:00`).
- Filtry kolekcji są **query params** (`?customer_id=...&statuses=...`).
- Paginacja (tam gdzie jest): `?page=1&page_size=20`. Odpowiedź:
  `PaginatedResponse[T]` (`items, total, page, page_size, pages`).

---

## 🔐 Auth

`POST /api/v1/auth/login/{username}` → `UserRead`

- Loguje przez mikroserwis AD (`http://ad:8001/ad/user?identity=…`).
- Jeśli użytkownik nie istnieje w `users` → tworzy.
- 404 — user nieznany w AD; 502 — AD niedostępny; 400 — duplikat loginu.

---

## 👤 Users

| Metoda | Ścieżka                | Body                | Odpowiedź                          |
|--------|------------------------|---------------------|------------------------------------|
| POST   | `/api/v1/users`        | `UserCreate`        | 201 `UserRead`                     |
| GET    | `/api/v1/users`        | —                   | 200 `PaginatedResponse[UserRead]` |
| GET    | `/api/v1/users/{id}`   | —                   | 200 `UserRead` / 404               |
| PATCH  | `/api/v1/users/{id}`   | `UserUpdate`        | 200 `UserRead` / 400 / 404         |
| DELETE | `/api/v1/users/{id}`   | —                   | 204 (soft → fallback hard) / 404   |

---

## 🏢 Companies

| Metoda | Ścieżka                    | Body              | Odpowiedź                              |
|--------|----------------------------|-------------------|----------------------------------------|
| POST   | `/api/v1/companies`        | `CompanyCreate`   | 201 `CompanyRead`                      |
| GET    | `/api/v1/companies`        | (paging)          | 200 `PaginatedResponse[CompanyRead]`   |
| GET    | `/api/v1/companies/{id}`   | —                 | 200 `CompanyRead` / 404                |
| PATCH  | `/api/v1/companies/{id}`   | `CompanyUpdate`   | 200 `CompanyRead` / 400 / 404          |
| DELETE | `/api/v1/companies/{id}`   | —                 | 204                                    |

---

## 👥 Customers (CRM)

```
GET    /api/v1/customers
POST   /api/v1/customers
GET    /api/v1/customers/{customer_id}
PATCH  /api/v1/customers/{customer_id}
DELETE /api/v1/customers/{customer_id}
GET    /api/v1/customers/{customer_id}/timeline
POST   /api/v1/customers/{customer_id}/ai-summary           ← AI
GET    /api/v1/customers/{customer_id}/ai-summary/stream    ← SSE
```

Filtry `GET /customers`:
- `q` — wyszukiwanie tekstowe (po `ckk` i polach pochodnych)
- `company_id`
- `manager_id` — alias na „klienci tego opiekuna"
- `statuses` — lista enum `CustomerStatus`
- `created_from`, `created_to` — `Date`

`GET /customers/{id}/timeline`:
- `from_date`, `to_date` (ISO datetime)
- `event_types` — multi enum (`TimelineEventType`: `note`, `activity`, `document`, ...)
- `limit` 1..500 (domyślnie 100)
- Zwraca posortowaną oś zdarzeń klienta (notatki + aktywności + dokumenty).

`POST /customers/{id}/ai-summary`:
- Generuje podsumowanie LLM (Gemma) na podstawie aktywnych umów,
  ostatnich notatek i otwartych alertów. Cache **in-memory 1h** (per id).
- Stream wariant — SSE z eventami `data: {"token": "..."}` aż do
  `data: {"done": true, "generated_at": "..."}`.

---

## 📞 Contact persons

(Pod-zasób klienta. Wszystkie endpointy są w kontekście `customer_id`.)

```
GET    /api/v1/customers/{customer_id}/contacts
POST   /api/v1/customers/{customer_id}/contacts
PATCH  /api/v1/customers/{customer_id}/contacts/{contact_id}
DELETE /api/v1/customers/{customer_id}/contacts/{contact_id}
```

Wymóg: `payload.customer_id == customer_id` (path) — inaczej 400.

---

## 📑 Contracts

```
GET    /api/v1/contracts
POST   /api/v1/contracts
GET    /api/v1/contracts/{contract_id}
PATCH  /api/v1/contracts/{contract_id}
DELETE /api/v1/contracts/{contract_id}
GET    /api/v1/contracts/{contract_id}/services
POST   /api/v1/contracts/{contract_id}/services
DELETE /api/v1/contracts/{contract_id}/services/{relation_id}
```

Filtry `GET /contracts`:
- `company_id`, `customer_id`
- `statuses` — multi enum `ContractStatus`
- `start_from`, `start_to` — zakres daty rozpoczęcia
- `end_from`, `end_to` — zakres daty końca

---

## 🛠️ Services & Service groups

```
GET    /api/v1/services?company_id=...&is_active=true
POST   /api/v1/services
GET    /api/v1/services/{service_id}
PATCH  /api/v1/services/{service_id}
DELETE /api/v1/services/{service_id}

GET    /api/v1/service-groups
POST   /api/v1/service-groups
GET    /api/v1/service-groups/{group_id}
PATCH  /api/v1/service-groups/{group_id}
DELETE /api/v1/service-groups/{group_id}
```

`ServiceGroup` ma materialized path (`path_id`, `path_name`). Aktualizacja
parenta wymaga ręcznego refreshu ścieżek (TODO ALF-XX).

---

## 💰 Customer rates

```
GET    /api/v1/customer-rates
POST   /api/v1/customer-rates
GET    /api/v1/customer-rates/{rate_id}
PATCH  /api/v1/customer-rates/{rate_id}
DELETE /api/v1/customer-rates/{rate_id}
```

Każdy `CustomerRate` ma 12 powiązanych `CustomerRateMonth` (jeden rekord
per miesiąc). Zob. `data-model/entities.md` → CustomerRate.

---

## 📈 Valorizations

```
GET    /api/v1/valorizations?contract_id=...&year=...&status=...
POST   /api/v1/valorizations
GET    /api/v1/valorizations/{valorization_id}
PATCH  /api/v1/valorizations/{valorization_id}
DELETE /api/v1/valorizations/{valorization_id}
```

Statusy: `pending`, `approved`, `applied`, `rejected`. Konstraint UNIQUE
`(contract_id, year)` — jedna waloryzacja na umowę na rok.

---

## 📝 Notes

```
GET    /api/v1/notes?customer_id=... | contract_id=...
POST   /api/v1/notes
GET    /api/v1/notes/{note_id}
PATCH  /api/v1/notes/{note_id}
DELETE /api/v1/notes/{note_id}
```

- `GET` wymaga **dokładnie jednego** filtra (`customer_id` XOR `contract_id`).
  Inaczej 422.
- Notatka może być przypisana do customer, contract lub obu (constraint
  CHECK: jeden z nich musi być != NULL).

---

## 📜 Activity log

```
GET    /api/v1/activity-log?customer_id=...&contract_id=...&limit=50&offset=0
POST   /api/v1/activity-log
```

- Niezmienialne — brak PATCH/DELETE.
- Typy: `meeting`, `email`, `note`, `document`, `verification`, `call`, `system`.

---

## 📄 Documents (attachments + S3)

```
GET    /api/v1/documents?company_id=...&customer_id=...&contract_id=...&exclude_draft=false&include_in_ai_assistant_only=false
POST   /api/v1/documents                                        ← multipart/form-data
GET    /api/v1/documents/{id}?requester_user_id=...
GET    /api/v1/documents/{id}/download-url?requester_user_id=...   ← presigned URL
GET    /api/v1/documents/{id}/stream?requester_user_id=...         ← bajty bezpośrednio
DELETE /api/v1/documents/{id}?requester_user_id=...
PATCH  /api/v1/documents/{id}/ai-assistant?requester_user_id=...   ← toggle (202)
POST   /api/v1/documents/bulk/ai-assistant?requester_user_id=...   ← bulk toggle (202)
POST   /api/v1/documents/{id}/reindex?requester_user_id=...        ← retry indeksacji (202)
```

**POST** (multipart):
| Pole                       | Typ        | Wymagane | Uwagi                              |
|----------------------------|------------|----------|------------------------------------|
| `file`                     | file       | tak      | PDF/DOCX/JPG/PNG/TXT, ≤10 MB       |
| `document_type`            | enum       | nie      | domyślnie `OTHER`                  |
| `company_id`               | UUID       | nie      | jeśli pusty, brany z customer.company |
| `customer_id`              | UUID       | nie\*    | \* jeden z `customer_id`/`contract_id` musi być |
| `contract_id`              | UUID       | nie\*    |                                    |
| `uploaded_by`              | UUID       | tak      | id użytkownika z `users`           |
| `include_in_ai_assistant`  | bool       | nie      | domyślnie `true`. `false` → `ocr_status='skipped'`, brak background task. |

Po uploadzie startuje **BackgroundTask**: `DocumentProcessingService.process(...)`
→ chunking + embedding + `INSERT document_chunks` → `ocr_status = done`.
Background task **nie startuje** gdy `include_in_ai_assistant=false` lub
MIME jest poza `_PROCESSABLE` (np. DOCX).

`exclude_draft=true` → filtruje `ocr_status != 'skipped'` (drafty z generacji
AI są `skipped`).

`include_in_ai_assistant_only=true` → filtruje `include_in_ai_assistant = true`.
Asystent AI (`/assistant`) używa `exclude_draft=true&include_in_ai_assistant_only=true`.

**PATCH `.../ai-assistant`** — body `{ "enabled": bool }`. Idempotentny.
- `enabled=true` + MIME wspierany → `ocr_status=pending`, fetch z S3,
  background reindex, ActivityLog.
- `enabled=true` + MIME niewspierany → `ocr_status=skipped`,
  `unsupported_format=true` w response, ActivityLog.
- `enabled=false` → DELETE chunków, `include_in_ai_assistant=false`,
  ActivityLog.

**POST `bulk/ai-assistant`** — body `{ ids: UUID[], enabled: bool }`.
Wynik per id w `results: AiAssistantBulkItemResult[]`.

**POST `{id}/reindex`** — wymusza retry indeksacji niezależnie od stanu
(np. dla `ocr_status=failed`). Przy okazji ustawia
`include_in_ai_assistant=true`.

Zob. [`../ai/ai-assistant-toggle.md`](../ai/ai-assistant-toggle.md).

---

## 🤖 RAG search

`POST /api/v1/rag/search`

Body (`RagSearchRequest`):
```json
{
  "customer_id": "uuid",
  "query": "kiedy kończy się umowa?",
  "ai_mode": false,
  "top_k": 5
}
```

Response (`RagSearchResponse`):
```json
{
  "chunks": [
    {
      "chunk_id": "uuid",
      "attachment_id": "uuid",
      "content": "...",
      "highlight": "podświetlone zdanie",
      "page_number": 3,
      "bbox": { "x0": 0, "y0": 0, "x1": 0, "y1": 0 },
      "section_title": null,
      "score": 0.84,
      "similarity": 0.92
    }
  ],
  "ai_answer": null,
  "no_results_found": false
}
```

Flow: embed query → search w `document_chunks` (filtrowane po `customer_id`,
distance ≤ `RAG_VEC_MAX_DISTANCE`=0.35) → **rerank** przez mikroserwis
(opcjonalnie) → top_k → opcjonalnie LLM (gdy `ai_mode=true`).

Zob. [`../ai/rag.md`](../ai/rag.md) — pełny opis pipeline'u.

---

## 🧾 Document generations (AI-assisted)

```
GET    /api/v1/document-generations/templates
POST   /api/v1/document-generations/preview
POST   /api/v1/document-generations?generated_by={user_id}
GET    /api/v1/document-generations?customer_id=...
GET    /api/v1/document-generations/{generation_id}
POST   /api/v1/document-generations/{generation_id}/accept     ← Body: GenerationAccept
POST   /api/v1/document-generations/{generation_id}/reject?rejected_by={user_id}
GET    /api/v1/document-generations/{generation_id}/preview-html
```

Stany generacji (`DocumentGenerationStatus`):
- `draft`, `preview` — wygenerowany podgląd, niepełny PDF (DRAFT watermark)
- `finalized` — PDF zlocked, czeka na akceptację
- `accepted` — zaakceptowany, czysty PDF, indeksowany w RAG
- `sent`, `superseded`, `rejected`

Pełny opis: [`../ai/document-generation.md`](../ai/document-generation.md).

---

## 📊 Dashboard

`GET /api/v1/dashboard/kpi?account_manager_id=...` → `DashboardKpi`:

```json
{
  "active_customers": 12,
  "active_contracts": 18,
  "contracts_expiring_30d": 2,
  "valorizations_pending": 3,
  "valorizations_overdue": 1
}
```

Liczone on-the-fly (joiny + `COUNT`), z opcjonalnym filtrem per opiekun.

---

## 🚨 Alerts

```
GET   /api/v1/alerts?account_manager_id=...        → list[AlertRead]
WS    /api/v1/alerts/ws/{client_id}                ← WebSocket
```

`GET` — generuje alerty **on-the-fly**:
- `contract_expiry_30 / 60 / 90` — umowa wygasa w danym oknie
- `valorization_overdue`, `valorization_pending`
- `no_contact` — brak aktywności > 90 dni (porównuje `created_at` klienta lub
  ostatnie wpisy w `activity_logs`)

`WS` — komunikat startowy `{"type":"connection_established", ...}` + echo dla
ewentualnych pingów. Pełna implementacja: `app/core/websockets.py` (`manager`).

---

## ✅ Status / Health

| Metoda | Ścieżka      | Odpowiedź                                                   |
|--------|--------------|-------------------------------------------------------------|
| GET    | `/`          | `{ "message": "Welcome to HRK Backend", "version": "0.1.0" }` |
| GET    | `/health`    | `{ "status": "ok", "environment": "development" }`         |

Health check **nie sprawdza** DB / S3 / Ollamy — to świadome (uvicorn
healthcheck w docker-compose ma być prosty). Realna diagnostyka idzie
przez logi + Postman collections w `backend/postman/`.

---

## Dalej

- [`services.md`](services.md) — opisy serwisów (logiki) za endpointami.
- [`../data-model/entities.md`](../data-model/entities.md) — encje, których
  zwracają i przyjmują endpointy.
