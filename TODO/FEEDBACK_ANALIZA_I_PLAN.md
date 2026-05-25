# 📋 Analiza feedbacku HRK vs stan projektu

> Data analizy: 2026-05-23  
> Feedback od: HRK Payroll Consulting  
> Projekt: HRK CRM (AlfaTeam, ZZPJ 2025/2026)

---

## 🟢 Co firma doceniła (i co MAMY zrobione)

| Punkt z feedbacku | Stan w projekcie | Gotowość |
|---|---|---|
| Integracja z Active Directory | ✅ `ad_login.py` + `LoginPage` + `authSlice` | **100%** |
| Backend FastAPI | ✅ Pełna architektura: API → Service → Repo → DB | **100%** |
| MinIO S3 do przechowywania plików | ✅ `StorageService` + `s3_client.py` + Docker | **100%** |
| RAG, chunking, embeddingi | ✅ `RAGService` + `EmbeddingService` + `RerankerClient` + `DocumentChunkRepository` (pgvector HNSW) | **100%** |
| Dynamiczne tabele (JSONB) | ✅ `additional_data` JSONB na Customer, Contract, Valorization, Service, Attachment | **100%** |
| Gotowa warstwa frontendu | ✅ 9 stron, pełny routing, TanStack Query + Redux | **100%** |
| Wektoryzacja dokumentów | ✅ `document_processing.py` (PDF → OCR → chunking → embedding → DB) | **100%** |
| Alerty przez websockety | ✅ `useAlertWebSockets.ts` + `core/websockets.py` | **100%** |

**Wniosek:** Warstwa technologiczna jest kompletna i firma to zauważyła. To nasza przewaga.

---

## 🟡 Co firma chce zobaczyć — porównanie z aktualnym stanem

### 1. Pełna karta klienta

| Wymaganie | Stan | Co brakuje |
|---|---|---|
| Dane firmy + osoby kontaktowe | ✅ `ClientsPage` tab "info" + `ContactPerson` CRUD | — |
| Przypisanie opiekunów | ✅ `account_manager_id` na Customer | — |
| Historia spotkań, maili, notatek | ✅ Tab "timeline" + `ActivityLog` + `Note` | — |
| Załączniki | ✅ Tab "documents" + `DocumentsTab` + `UploadWizard` | — |
| Status klienta | ✅ `CustomerStatus` (active/churn_risk/needs_attention/inactive) | — |
| Podsumowanie AI | ✅ `CustomerAiSummaryService` + streaming | — |

**✅ GOTOWE** — karta klienta jest pełna i podłączona do API.

---

### 2. Pełna karta umowy

| Wymaganie | Stan | Co brakuje |
|---|---|---|
| CRUD umów | ✅ `ContractsPage` + `ContractModal` | — |
| Cykl życia: draft → signed → active → expiring → terminated | ✅ `ContractStatus` enum + badge'e na UI | — |
| Powiązanie z klientem | ✅ `customer_id` FK + filtrowanie | — |
| Okres wypowiedzenia | ✅ `notice_period_days` + `notice_conditions` | — |
| Dokument umowy (PDF) | ✅ `primary_document_id` + `UploadWizard` po utworzeniu | — |
| Aneksy | ✅ Model `ContractAmendment` + relacja | — |
| Usługi na umowie | ✅ `ContractService` model + API | — |

**✅ GOTOWE** — karta umowy jest kompletna.

---

### 3. Cenniki, stawki i reguły cenowe

| Wymaganie | Stan | Co brakuje |
|---|---|---|
| Model stawek per usługa/rok | ✅ `CustomerRate` + `CustomerRateMonth` (1-12) | — |
| Rabaty | ✅ `discount_pct` na `CustomerRate` | — |
| Jednostki rozliczeniowe | ✅ `BillingUnit` (per_person/ryczalt/per_hour/per_doc/per_item) | — |
| Częstotliwość | ✅ `BillingFrequency` (monthly/quarterly/one_time/on_demand) | — |
| **UI do zarządzania stawkami** | ⚠️ API istnieje, ale **brak dedykowanej strony/taba na froncie** | Dodać tab "Stawki" w karcie umowy |

**⚠️ Backend gotowy, frontend wymaga UI** — stawki nie są widoczne w interfejsie.

---

### 4. Waloryzacja i oś czasu zmian

| Wymaganie | Stan | Co brakuje |
|---|---|---|
| Model waloryzacji | ✅ `Valorization` (index_type, index_value, planned_date, applied_date, status) | — |
| Statusy: pending → approved → applied / rejected | ✅ `ValorizationStatus` enum | — |
| API CRUD | ✅ `/valorizations` endpoint | — |
| **Frontend ValorizationPage** | ❌ **MOCK DATA** — KPI, reguły, pipeline są hardcoded | **Podłączyć do API** |
| Generowanie aneksu waloryzacyjnego | ✅ `DocumentGenerationService` + szablony HTML + symulator + LLM | — |
| Wizard generowania dokumentu | ✅ `DocumentWizard` na froncie | — |

**❌ KRYTYCZNE** — ValorizationPage to jedyny ekran z mockami. Trzeba podłączyć do istniejącego API.

---

### 5. Alerty końca umowy, wypowiedzenia i waloryzacji

| Wymaganie | Stan | Co brakuje |
|---|---|---|
| Alert: umowa kończy się za 90/60/30 dni | ✅ `AlertService._contract_expiry_alerts()` | — |
| Alert: waloryzacja po terminie | ✅ `AlertService._valorization_alerts()` | — |
| Alert: brak kontaktu | ✅ `AlertService._no_contact_alerts()` | — |
| Wyświetlanie na dashboardzie | ✅ `DashboardPage` pobiera alerty z API | — |
| WebSocket push | ✅ `useAlertWebSockets` | — |

**✅ GOTOWE** — system alertów działa end-to-end.

---

### 6. Kontrola zaufania do odpowiedzi AI

| Wymaganie | Stan | Co brakuje |
|---|---|---|
| Źródło odpowiedzi (dokument) | ✅ `attachment_id` w `ChunkResult` | — |
| Cytat z dokumentu | ✅ `highlight` (best sentence matching) | — |
| Numer strony | ✅ `page_number` w odpowiedzi | — |
| Similarity score | ✅ `similarity` (cosine) + `score` (reranker) | — |
| **Confidence score (jawny %)** | ⚠️ Mamy `similarity` 0-1, ale nie jest prezentowany jako "confidence" | Dodać label "Pewność: X%" na UI |
| Podgląd PDF ze źródłem | ✅ `PdfPreviewModal` + nawigacja do strony | — |

**⚠️ Prawie gotowe** — brakuje tylko jawnego labela "confidence" na froncie.

---

### 7. Flow dokumentu: upload → storage → wektoryzacja → dostępność w CRM

| Wymaganie | Stan | Co brakuje |
|---|---|---|
| Upload dokumentu | ✅ `UploadWizard` | — |
| Zapis do S3 | ✅ `StorageService.upload()` | — |
| Ekstrakcja tekstu (PDF/OCR) | ✅ `document_processing.py` (pdfplumber + pytesseract) | — |
| Chunking | ✅ 1600 chars / 320 overlap | — |
| Embedding + zapis do pgvector | ✅ `EmbeddingService` → `DocumentChunk` | — |
| Status OCR na UI | ✅ `OcrStatusBadge` (pending/processing/done/failed) | — |
| Wyszukiwanie przez AI | ✅ `AdvisorPage` → RAG | — |
| Powiązanie z umową | ✅ `contract_id` na `Attachment` | — |

**✅ GOTOWE** — pełny pipeline działa end-to-end. To jest dokładnie scenariusz, który firma chce zobaczyć.

---

### 8. Integracja z OCR

| Wymaganie | Stan | Co brakuje |
|---|---|---|
| OCR dla skanów | ✅ `pytesseract` + `pdf2image` (hybrid: pdfplumber → fallback OCR) | — |
| Status śledzenia | ✅ `OcrStatus` enum + badge na UI | — |

**✅ GOTOWE.**

---

### 9. Wymagania sprzętowe dla lokalnego modelu AI

| Wymaganie | Stan | Co brakuje |
|---|---|---|
| Dokumentacja wymagań | ⚠️ Brak jawnego dokumentu | **Dodać sekcję w README/docs** |

**⚠️ Brakuje** — trzeba opisać: RAM (min 16GB), GPU (opcjonalnie), Ollama, model Gemma 4.

---

### 10. TimeSheet i rentowność

| Wymaganie | Stan | Co brakuje |
|---|---|---|
| Integracja z TimeSheet | ❌ Nie istnieje | Poza MVP — wyjaśnić na prezentacji |
| Dane rentowności | ❌ Nie istnieje | Poza MVP — wyjaśnić na prezentacji |

**❌ Poza zakresem MVP** — ale warto pokazać, gdzie w architekturze to się wpina.

---

### 11. Zasady dostępu do stawek, dokumentów i AI

| Wymaganie | Stan | Co brakuje |
|---|---|---|
| Role użytkowników | ✅ `UserRole` (admin/account_manager/manager/viewer) | — |
| Kontrola dostępu per klient | ⚠️ Model `user_company_access` / `user_contract_access` istnieje w cache pyc | Upewnić się, że jest aktywny |
| Presigned URL do dokumentów | ✅ `s3_client.py` generuje presigned URLs | — |

**⚠️ Częściowo** — mechanizm istnieje, ale trzeba zweryfikować enforcement na API.

---

## 🔴 PRIORYTETY NA FINAŁ (co robić)

### P0 — KRYTYCZNE (musi być na prezentacji)

| # | Zadanie | Effort | Opis |
|---|---|---|---|
| 1 | **Podłączyć ValorizationPage do API** | 🔴 2-3 dni | Zamienić mock data na `useValorisations()` hook, dodać CRUD, pipeline z prawdziwych danych |
| 2 | **Demo scenariusz end-to-end** | 🟡 1 dzień | Przygotować seed data + nagranie/live demo: login AD → klient → upload → OCR → RAG → źródło → alert |
| 3 | **Dodać tab "Stawki" w karcie umowy** | 🟡 1-2 dni | UI do przeglądania/edycji `CustomerRate` per umowa (API już istnieje) |

### P1 — WAŻNE (mocno podnosi ocenę)

| # | Zadanie | Effort | Opis |
|---|---|---|---|
| 4 | **Confidence score na UI asystenta** | 🟢 2-4h | Wyświetlić `similarity` jako "Pewność: 87%" przy każdym źródle |
| 5 | **Dokumentacja wymagań sprzętowych AI** | 🟢 1-2h | Sekcja w docs: RAM, GPU, Ollama, modele, czas odpowiedzi |
| 6 | **Usunąć mock smart pulse z DashboardPage** | 🟢 2-4h | Podłączyć do `CustomerRelationScore` lub usunąć |
| 7 | **Oś czasu waloryzacji na karcie umowy** | 🟡 4-6h | Timeline zmian stawek per umowa (dane z `Valorization` + `CustomerRate`) |

### P2 — NICE TO HAVE (jeśli starczy czasu)

| # | Zadanie | Effort | Opis |
|---|---|---|---|
| 8 | Placeholder na TimeSheet/rentowność | 🟢 1h | Sekcja "Planowane integracje" w UI z opisem architektury |
| 9 | Weryfikacja enforcement ról na API | 🟡 4h | Sprawdzić, że viewer nie może edytować stawek |
| 10 | Eksport raportu waloryzacji do PDF/Excel | 🟡 4-6h | Przycisk "Eksportuj" na ValorizationPage |

---

## 🎯 Rekomendowany scenariusz na prezentację

Firma wprost poprosiła o ten flow:

```
1. Użytkownik loguje się przez AD
   → LoginPage (✅ gotowe)

2. Wybiera klienta
   → ClientsPage z listą + karta klienta (✅ gotowe)

3. Dodaje dokument
   → UploadWizard w tab "Dokumenty" (✅ gotowe)

4. Dokument trafia do storage
   → S3/MinIO upload (✅ gotowe)

5. System segmentuje i wektoryzuje
   → document_processing → chunking → embedding (✅ gotowe)
   → OcrStatusBadge pokazuje postęp (✅ gotowe)

6. Użytkownik wyszukuje informacje przez AI
   → AdvisorPage, wybór klienta, pytanie (✅ gotowe)

7. System pokazuje źródło odpowiedzi
   → highlight, page_number, attachment_id, similarity (✅ gotowe)
   → PdfPreviewModal z nawigacją do strony (✅ gotowe)

8. Dane powiązane z umową i alertem
   → contract_id na Attachment (✅ gotowe)
   → AlertService generuje alerty (✅ gotowe)
```

**Ten scenariusz jest W PEŁNI FUNKCJONALNY już teraz.** Wystarczy go przećwiczyć z dobrymi danymi demo.

---

## 📊 Podsumowanie gotowości

| Obszar | Gotowość | Komentarz |
|---|---|---|
| Karta klienta | ✅ 100% | Pełna, z AI summary |
| Karta umowy | ✅ 95% | Brakuje taba stawek |
| Cykl życia umowy | ✅ 100% | draft → signed → active → expiring → terminated |
| Waloryzacja (backend) | ✅ 100% | Model + API + generator aneksów |
| Waloryzacja (frontend) | ❌ 20% | Mock data, nie podłączone |
| Alerty | ✅ 100% | 3 typy + WebSocket + dashboard |
| RAG / AI assistant | ✅ 95% | Brakuje jawnego confidence label |
| Pipeline dokumentów | ✅ 100% | Upload → S3 → OCR → chunk → embed → search |
| Generowanie dokumentów | ✅ 100% | Symulator + szablony + LLM narrative + PDF |
| Autentykacja AD | ✅ 100% | Login + role |
| Rentowność / TimeSheet | ❌ 0% | Poza MVP |

**Ogólna gotowość: ~85%** — główna luka to frontend waloryzacji.

---

## 💡 Kluczowy przekaz na prezentację

> "Najpierw stabilne dane CRM, potem AI na ich podstawie."

Firma chce zobaczyć, że AI **wspiera** proces, a nie go zastępuje. Nasz projekt to ma — ale na prezentacji trzeba to **pokazać w kolejności biznesowej**:

1. Klient istnieje w systemie (dane, status, opiekun)
2. Ma umowę z usługami i stawkami
3. System pilnuje terminów (alerty)
4. Dokumenty są przechowywane i indeksowane
5. AI pomaga szukać i podpowiadać — ze źródłem

**NIE zaczynać prezentacji od RAG/AI.** Zacząć od karty klienta → umowy → waloryzacji → dopiero potem AI.
