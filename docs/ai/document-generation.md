# AI — generowanie dokumentów (aneks waloryzacyjny + pismo przewodnie)

## Cel

Opisać, jak HRK CRM tworzy **aneks waloryzacyjny** i **pismo przewodnie**
na bazie szablonów Jinja2 + symulacji finansowej + LLM (część narracyjna).

> Plik łączy się z [`rag.md`](rag.md) (po akceptacji aneks ląduje w RAG)
> i [`../data-model/entities.md`](../data-model/entities.md) →
> `document_generations`.

---

## Cykl życia (statusy)

```
   draft  →  preview  →  finalized  →  accepted  →  sent
                                  ↘
                                   rejected
                       (lub kiedy zastąpione: superseded)
```

| Status | Opis |
|---|---|
| `draft` / `preview` | Wygenerowany podgląd, PDF z watermarkiem **DRAFT**. Nie jest w RAG. |
| `finalized` | PDF zlocked, czeka na akceptację. |
| `accepted` | Czysty PDF (bez watermarka) zaakceptowany przez opiekuna. Wchodzi do RAG. |
| `sent` | Wysłany do klienta. |
| `superseded` | Zastąpiony nowszą wersją (regeneracja). |
| `rejected` | Odrzucony przez opiekuna. |

Pełna definicja: [`../data-model/enums.md`](../data-model/enums.md) →
`DocumentGenerationStatus`.

---

## Architektura

```
API router  →  DocumentGenerationService  →  repos / services
                            │
                            ├── ValorizationContextRepository  (read-only joiny: customer/contract/services/rates)
                            ├── ValorizationSimulator          (kalkulacje finansowe — pure Python)
                            ├── TemplateRegistry               (Jinja2: manifest.yml + .html)
                            ├── LLMService                     (cover letter + rationale — narracja)
                            ├── PdfRenderer                    (WeasyPrint: HTML → PDF)
                            ├── StorageService                 (upload finalnego PDF do S3)
                            └── AttachmentRepository
                                DocumentGenerationRepository   (snapshot do DB)
```

**Zasada żelazna:** liczby w PDF **zawsze** pochodzą z symulatora.
LLM dorzuca **wyłącznie narrację** (cover letter + 3-5 punktów uzasadnienia).
Daty, klauzule prawne, kwoty — nie są generowane przez LLM.

---

## API

| Metoda | Ścieżka                                                     | Co robi |
|--------|-------------------------------------------------------------|---------|
| GET    | `/api/v1/document-generations/templates`                    | Lista dostępnych szablonów |
| POST   | `/api/v1/document-generations/preview`                      | Render HTML + symulacja (bez PDF, bez DB) |
| POST   | `/api/v1/document-generations?generated_by={user_id}`       | Render PDF z DRAFT, upload do S3, zapis snapshot |
| GET    | `/api/v1/document-generations?customer_id={id}`             | Lista generacji dla klienta |
| GET    | `/api/v1/document-generations/{id}`                         | Szczegóły generacji |
| POST   | `/api/v1/document-generations/{id}/accept`                  | Akceptacja: czysty PDF, indeksacja w RAG |
| POST   | `/api/v1/document-generations/{id}/reject?rejected_by={id}` | Odrzucenie |
| GET    | `/api/v1/document-generations/{id}/preview-html`            | Re-render HTML (debug / iframe) |

---

## Flow `preview`

```
client   ──┐ POST /preview
            │  body: GenerationRequest
            ▼
DocumentGenerationService.preview(request):
    context, simulation = build_context_and_simulation(request)
       ├── ValorizationContextRepository.fetch_customer_with_contract(...)
       ├── ValorizationContextRepository.fetch_rates(...)
       └── simulate_valorization(contract, rates, services, params)
    rendered_html = TemplateRegistry.render_main(template_key, ctx)
    return GenerationPreviewResponse(simulation, rendered_html, ...)
```

- **Nie dotyka** S3 ani DB.
- LLM (rationale, cover letter) **świadomie pominięty** — preview ma być
  szybki. Te części są generowane dopiero w `finalize`.

---

## Flow `finalize`

```
POST /document-generations?generated_by={user_id}
   body: GenerationRequest

DocumentGenerationService.finalize(request, generated_by):
    context, simulation = build_context_and_simulation(request)
    facts = build_llm_facts(...)              # liczby + daty z DB

    if request.include_ai_rationale:
        rationale_bullets = await llm.generate_rationale_bullets(facts, tone, instructions)
    if request.include_cover_letter:
        cover_letter_text = await llm.generate_cover_letter(facts, tone, instructions)

    amendment_html = registry.render_main(template_key, { ..., draft=True })
    amendment_pdf  = await renderer.render(amendment_html)

    s3_key = "companies/{cid}/generated/{uuid}_aneks_X_DRAFT.pdf"
    await storage.upload_bytes(s3_key, amendment_pdf, "application/pdf")

    attachment = await attachment_repo.create({
        ..., ocr_status=OcrStatus.SKIPPED,    # ← draft NIE trafia do RAG
    })

    generation = await gen_repo.create({
        customer_id, contract_id, template_key, template_version,
        status=PREVIEW,
        payload={...request snapshot...},
        simulation={...},
        ai_artifacts={"rationale": [...], "cover_letter": "...", "tone": "...",
                       "model": OPENROUTER_MODEL, "prompt_hash": sha256(...)},
        attachment_pdf_id=attachment.id,
        generated_by=user_id,
    })
    await session.commit()
    return generation
```

`ocr_status='skipped'` jest sygnałem dla `DocumentService.list_documents`
(z `exclude_draft=true`), że plik nie powinien być widoczny w RAG.

### Watermark DRAFT

Szablony Jinja2 mają zmienną `draft: bool`. Gdy `True`, w CSS pojawia się
duży, półprzezroczysty napis „DRAFT" przez całą stronę.

---

## Flow `accept`

```
POST /document-generations/{id}/accept
   body: { accepted_by: <user_id> }

DocumentGenerationService.accept(generation_id, accepted_by, background_tasks):
    gen = await gen_repo.get(id)

    # 1. Zapamiętaj klucze starych draftów (przed commitem nowego stanu)
    old_pdf_key  = gen.pdf_attachment.s3_key
    old_pdf_id   = gen.attachment_pdf_id
    # (analogicznie cover letter)

    # 2. Render nowego PDF (draft=False) i upload
    clean_html = registry.render_main(gen.payload.template_key, {..., draft=False})
    clean_pdf  = await renderer.render(clean_html)
    new_key    = "companies/{cid}/generated/{uuid}_aneks_X_FINAL.pdf"
    await storage.upload_bytes(new_key, clean_pdf, "application/pdf")
    new_attachment = await attachment_repo.create({
        ..., ocr_status=OcrStatus.PENDING,    # ← do indeksacji w RAG
    })

    # 3. Aktualizacja generacji + commit (transakcja 1)
    gen.status = ACCEPTED
    gen.attachment_pdf_id = new_attachment.id
    gen.accepted_by = accepted_by
    gen.pdf_sha256 = sha256(clean_pdf)
    await session.commit()

    # 4. Zaplanuj indeksację (background)
    background_tasks.add_task(
        DocumentProcessingService().process,
        new_attachment.id, gen.customer_id, clean_pdf, "application/pdf",
    )

    # 5. Best-effort cleanup starego draftu
    try:
        await storage.delete_object(old_pdf_key)
        await attachment_repo.delete(old_pdf_id, soft=False)
        await session.commit()
    except StorageServiceError:
        logger.warning(...)   # nie blokuj akceptacji
```

**Kolejność** jest krytyczna: commit nowego stanu **przed** usunięciem
starych draftów zapewnia spójność przy awariach.

---

## Szablony (`backend/src/app/templates/documents/`)

```
templates/documents/
├── _shared/                    # wspólne style / makra
├── amendment_valorization/
│   ├── manifest.yml            # key, version, title, description, params_schema
│   ├── amendment.html.j2       # treść aneksu (z makrami liczb)
│   └── cover_letter.html.j2    # pismo przewodnie
└── cover_letter/
    ├── manifest.yml
    └── ...
```

`manifest.yml`:
```yaml
key: amendment_valorization
version: "1.2.0"
title: "Aneks waloryzacyjny"
description: |
  Aneks indeksacji stawek per usługa, z opcjonalnym pismem przewodnim.
output_document_type: amendment
creates_amendment: true
template_file: amendment.html.j2
cover_letter_template_file: cover_letter.html.j2
params_schema: { ... JSON schema dla GenerationRequest.params ... }
```

`TemplateRegistry`:
- Singleton, ładuje manifesty raz.
- StrictUndefined — błąd przy próbie użycia niezdefiniowanej zmiennej w szablonie.
- Filtry polskie: `pl_date`, `pl_datetime`, `pl_money`, `pl_money_signed`, `pl_pct`.

---

## Symulator (`document_generation/simulator.py`)

Pure Python, **bez** dostępu do DB. Zwraca dataclassę `SimulationSummary`:

```python
@dataclass
class ServiceSimulation:
    contract_service_id: UUID
    service_name: str
    current_base_price: Decimal
    discount_pct: Decimal
    current_effective_price: Decimal
    applied_index_pct: Decimal
    proposed_base_price: Decimal
    proposed_effective_price: Decimal
    delta_per_period: Decimal
    delta_yearly: Decimal
    billing_cycle: str | None
    billing_unit: str | None

@dataclass
class SimulationSummary:
    services: list[ServiceSimulation]
    current_annual_revenue: Decimal
    proposed_annual_revenue: Decimal
    delta_annual_revenue: Decimal
    delta_annual_revenue_pct: Decimal
    weighted_avg_index_pct: Decimal
```

Logika (uproszczona):
```
proposed_base    = base_price * (1 + index_pct/100)
effective_price  = base_price * (1 - discount_pct/100)
periods_per_year = 12 / 4 / 1 (zależy od billing_cycle)
delta_yearly     = (proposed_effective - current_effective) * periods
```

Ważone procentowo: indeks średni z waluacji per usługa po `current_effective_price`.

---

## LLM — pismo przewodnie + rationale

`LLMService.generate_cover_letter(facts, tone, user_instructions)`:

System prompt (skrót):
```
Jesteś specjalistą ds. kluczowych klientów w HRK Payroll Consulting.
Piszesz pismo przewodnie do aneksu waloryzacyjnego umowy.
Napisz 3-4 akapity profesjonalnego, rzeczowego pisma w języku polskim.
ZASADY:
1) Nigdy nie wymyślaj liczb, dat ani klauzul — używaj tylko dostarczonych.
2) Nie cytuj tabel ani paragrafów aneksu — pismo to narracja.
3) Zachowaj ton zgodny z parametrem 'tone'.
4) Uwzględnij dodatkowe wytyczne użytkownika (jeśli są), ale nie kosztem profesjonalizmu.
5) Zwróć WYŁĄCZNIE treść pisma — bez nagłówków typu "Szanowni Państwo" / podpisu.
```

`tone`: `formal` | `neutral` | `warm` | `assertive`.

`facts` to dict liczbowo-datowy zbudowany w serwisie, np.:
```python
{
  "klient": "Empik S.A.",
  "umowa_nr": "ABC/2024/12",
  "rok_waloryzacji": 2026,
  "wskaznik_GUS_CPI": "4.50%",
  "wzrost_roczny": "+12 480,00 zł",
  ...
}
```

`generate_rationale_bullets(...)` — analogicznie, wynik to lista 3-5
krótkich punktów (jednozdaniowych).

---

## Reproducibility (PDF byte-for-byte)

`DocumentGeneration` zawiera **pełen snapshot**:
- `payload` — request input (wybrane usługi, ton, instrukcje, wskaźnik).
- `simulation` — dokładny wynik symulatora.
- `ai_artifacts` — generowane teksty + nazwa modelu + hash promptu.
- `template_version` — wersja szablonu (semver).
- `pdf_sha256` — SHA-256 finalnego PDF (po `accept`).

Aby odtworzyć PDF z przeszłości:
1. Pobierz `payload` + `simulation` + `ai_artifacts`.
2. Przejdź na ten sam `template_version` (git checkout).
3. Render → `pdf_sha256` powinien się zgadzać.

---

## Dalej

- [`rag.md`](rag.md) — co się dzieje z PDF po akceptacji (wchodzi do
  RAG).
- [`../data-model/entities.md`](../data-model/entities.md) →
  `document_generations`.
- [`../workflows/document-generation.md`](../workflows/document-generation.md)
  — perspektywa operacyjna (UI flow).
