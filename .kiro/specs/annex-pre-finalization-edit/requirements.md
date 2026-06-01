# Dokument wymagań — ALF-93: Edycja danych przed finalizacją aneksu

## Introduction

Funkcja umożliwia pracownikowi (opiekunowi klienta) ręczną korektę danych wygenerowanego szkicu aneksu przed zatwierdzeniem finalnego PDF. Szkic aneksu jest tworzony przez AI-wspomagany potok generowania dokumentów (`DocumentGenerationService`). Po wygenerowaniu szkicu (status `preview`) pracownik może jednorazowo zmodyfikować wybrane dane wejściowe (parametry waloryzacji, treści narracyjne wygenerowane przez AI, datę wejścia w życie) bez ponownego wywołania AI ani regeneracji całego dokumentu. Po zapisaniu korekty system renderuje nowy PDF DRAFT w oparciu o poprawiony payload i zastępuje nim poprzedni. Następnie pracownik może zaakceptować poprawiony dokument standardową ścieżką.

Celem jest zapewnienie pracownikowi pełnej kontroli nad treścią aneksu przy zachowaniu niezmienionej logiki biznesowej generowania i akceptacji dokumentów.

## Glossary

- **Aneks (Amendment)**: dokument waloryzacyjny powiązany z kontraktem, generowany przez `DocumentGenerationService`.
- **Szkic (DRAFT/PREVIEW)**: wstępna wersja aneksu z widocznym znakiem wodnym „DRAFT", przechowywana jako plik PDF w S3. Status w bazie: `preview`.
- **Payload**: pole JSONB w modelu `DocumentGeneration` przechowujące pełen snapshot parametrów wejściowych (żądanie generacji, numer i datę aneksu). Jest jedynym źródłem danych przy re-renderowaniu.
- **AI Artifacts**: pole JSONB w modelu `DocumentGeneration` zawierające narrację wygenerowaną przez LLM (punkty uzasadnienia, treść pisma przewodniego). Nigdy nie zawiera wartości liczbowych.
- **Simulation**: pole JSONB w modelu `DocumentGeneration` zawierające wyliczone wartości finansowe (delta przychodów, zestawienie usług).
- **Edycja payload**: modyfikacja danych w polach `payload` i/lub `ai_artifacts` istniejącego rekordu `DocumentGeneration` o statusie `preview`.
- **Re-render DRAFT**: wygenerowanie nowego pliku PDF DRAFT na podstawie zaktualizowanego payload oraz simulation i zastąpienie nim poprzedniego załącznika.
- **Pracownik / Opiekun klienta**: użytkownik CRM z rolą `account_manager` lub wyższą, uprawniony do edycji dokumentów.
- **Edit_Service**: nowy komponent serwisu odpowiedzialny za operację edycji payload w obrębie istniejącej sesji generowania dokumentu.
- **Edit_API**: nowy endpoint HTTP obsługujący żądanie edycji.
- **Frontend_Edit_View**: widok edycji w interfejsie React umożliwiający pracownikowi modyfikację pól szkicu aneksu.

## Requirements

### Requirement 1: Udostępnienie edycji szkicu aneksu pracownikowi

**User Story:** Jako opiekun klienta chcę móc edytować dane szkicu aneksu po jego wygenerowaniu przez AI, tak aby móc dokonać korekty bez konieczności ponownego wywołania całego procesu generowania.

#### Kryteria akceptacji

1. WHEN generacja dokumentu osiągnie status `preview`, THE Edit_API SHALL udostępnić operację edycji wyłącznie dla tego rekordu.
2. WHEN generacja dokumentu osiągnie status inny niż `preview`, THE Edit_API SHALL zwrócić kod błędu HTTP 409 z komunikatem opisującym niedozwolony status.
3. THE Edit_API SHALL wymagać podania identyfikatora pracownika (`edited_by`) jako parametru żądania.
4. WHEN żądanie edycji nie zawiera identyfikatora pracownika (`edited_by`), THE Edit_API SHALL zwrócić kod błędu HTTP 422.

---

### Requirement 2: Zakres pól możliwych do edycji

**User Story:** Jako opiekun klienta chcę móc zmodyfikować konkretne pola danych aneksu (parametry waloryzacji, narrację AI, datę wejścia w życie), tak aby zachować kontrolę nad ostateczną treścią dokumentu, nie naruszając wyliczonych danych finansowych.

#### Kryteria akceptacji

1. THE Edit_Service SHALL zezwalać na modyfikację następujących pól w `payload.request`: `index_value`, `effective_date`, `user_instructions`, `tone`.
2. THE Edit_Service SHALL zezwalać na modyfikację pola `ai_artifacts.rationale_bullets` (lista punktów uzasadnienia).
3. THE Edit_Service SHALL zezwalać na modyfikację pola `ai_artifacts.cover_letter_text` (treść pisma przewodniego).
4. THE Edit_Service SHALL zachować bez zmian pola `simulation`, `payload.amendment_number`, `payload.amendment_date`, `contract_id`, `customer_id`, `template_key` i `template_version`.
5. WHEN żądanie edycji zawiera próbę modyfikacji pola `simulation`, THE Edit_Service SHALL zignorować tę wartość i zachować istniejącą symulację.
6. THE Edit_Service SHALL zachować istniejące wartości pól niewymienionych w żądaniu edycji (częściowa aktualizacja — semantyka PATCH).

---

### Requirement 3: Re-render PDF DRAFT po edycji

**User Story:** Jako opiekun klienta chcę, żeby po zapisaniu moich zmian system automatycznie wygenerował nowy plik PDF DRAFT, tak abym mógł natychmiast podejrzeć poprawiony dokument.

#### Kryteria akceptacji

1. WHEN edycja payload zostanie zapisana, THE Edit_Service SHALL wyrenderować nowy plik PDF DRAFT (ze znakiem wodnym) na podstawie zaktualizowanego payload i niezmodyfikowanego simulation.
2. WHEN nowy PDF DRAFT zostanie wygenerowany pomyślnie, THE Edit_Service SHALL przesłać nowy plik do S3 i zaktualizować pole `attachment_pdf_id` rekordu `DocumentGeneration`.
3. WHEN nowy PDF DRAFT zostanie przesłany do S3, THE Edit_Service SHALL usunąć poprzedni plik PDF DRAFT z S3 oraz odpowiadający mu rekord `Attachment` metodą hard delete.
4. WHEN generacja aneksu zawiera pismo przewodnie (`cover_letter_attachment_id` nie jest null) i edycja modyfikuje `ai_artifacts.cover_letter_text`, THE Edit_Service SHALL wyrenderować nowy PDF pisma przewodniego DRAFT i zastąpić poprzedni w S3.
5. IF przesłanie nowego pliku PDF do S3 zakończy się błędem, THEN THE Edit_Service SHALL zwrócić kod błędu HTTP 502, zachować poprzedni payload bez zmian i nie zmieniać statusu rekordu.

---

### Requirement 4: Nienaruszalność statusu rekordu po edycji

**User Story:** Jako opiekun klienta chcę, żeby po edycji dokument nadal był w statusie `preview`, tak aby mógł przejść standardową ścieżkę akceptacji bez żadnych dodatkowych kroków.

#### Kryteria akceptacji

1. WHEN operacja edycji zakończy się sukcesem, THE Edit_Service SHALL utrzymać status rekordu `DocumentGeneration` jako `preview`.
2. THE Edit_Service SHALL nie zmieniać pola `generated_by`, `created_at` ani numeru aneksu po operacji edycji.
3. WHEN edycja zostanie zapisana, THE Edit_Service SHALL zarejestrować zdarzenie w `ActivityLog` z typem `DOCUMENT` i opisem zawierającym identyfikator generacji oraz login pracownika.

---

### Requirement 5: Interfejs użytkownika — widok edycji szkicu aneksu

**User Story:** Jako opiekun klienta chcę mieć wygodny formularz edycji szkicu aneksu w CRM, tak abym mógł szybko dokonać poprawek bez opuszczania aplikacji.

#### Kryteria akceptacji

1. THE Frontend_Edit_View SHALL wyświetlić formularz edycji wyłącznie dla generacji o statusie `preview`.
2. THE Frontend_Edit_View SHALL zawierać pola edycji: `index_value` (liczba dziesiętna), `effective_date` (data), `tone` (lista wyboru), `user_instructions` (tekst wieloliniowy), `rationale_bullets` (lista edytowalnych punktów tekstowych), `cover_letter_text` (tekst wieloliniowy, jeśli generacja posiada pismo przewodnie).
3. WHEN pracownik zapisze zmiany, THE Frontend_Edit_View SHALL wysłać żądanie PATCH do Edit_API i wyświetlić zaktualizowany podgląd HTML aneksu bez przeładowania strony.
4. WHEN Edit_API zwróci kod błędu, THE Frontend_Edit_View SHALL wyświetlić komunikat błędu zrozumiały dla użytkownika i nie opuścić widoku edycji.
5. WHILE żądanie zapisu jest przetwarzane, THE Frontend_Edit_View SHALL zablokować przycisk „Zapisz" i wyświetlić wskaźnik ładowania.
6. THE Frontend_Edit_View SHALL wyświetlić przycisk „Akceptuj" prowadzący do istniejącego przepływu akceptacji (bez zmian w istniejącej logice).

---

### Requirement 6: Idempotentność i bezpieczeństwo edycji

**User Story:** Jako opiekun klienta chcę mieć pewność, że edycja szkicu jest bezpieczna i nie naruszy integralności danych powiązanych z kontraktem.

#### Kryteria akceptacji

1. THE Edit_Service SHALL nie modyfikować żadnych rekordów w tabelach `contracts`, `contract_amendments`, `customers`, `contract_services` ani `rates` w trakcie operacji edycji.
2. WHEN ta sama edycja zostanie wysłana dwukrotnie z identycznym payload, THE Edit_Service SHALL nadpisać dane i wygenerować nowy PDF — wynik będzie ekwiwalentny funkcjonalnie do jednorazowego wywołania (idempotentność rezultatu).
3. THE Edit_Service SHALL walidować typ danych pola `index_value` jako liczbę dziesiętną z co najwyżej 4 miejscami po przecinku przed zapisem.
4. THE Edit_Service SHALL walidować format pola `effective_date` jako datę zgodną z ISO 8601 przed zapisem.
5. IF walidacja dowolnego pola edycji nie powiedzie się, THEN THE Edit_Service SHALL zwrócić kod błędu HTTP 422 ze szczegółowym opisem naruszenia dla każdego nieprawidłowego pola.
