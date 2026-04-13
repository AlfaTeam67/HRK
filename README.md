# 🚀 HRK CRM

> Inteligentny moduł CRM dla HRK Payroll Consulting: karta klienta, automatyzacja pracy i wsparcie LLM.

![Status](https://img.shields.io/badge/status-in%20progress-2563eb)
![Team](https://img.shields.io/badge/team-AlfaTeam-7c3aed)
![Backend](https://img.shields.io/badge/backend-Python%20API-10b981)
![Database](https://img.shields.io/badge/database-PostgreSQL%20%2B%20JSONB-0ea5e9)
![AI](https://img.shields.io/badge/AI-phi--3.5%20%40%20Ollama-f59e0b)

## ✨ O projekcie

**HRK CRM** to projekt semestralny realizowany dla HRK Payroll Consulting (ZZPJ 2025/2026).

System ma wspierać zespół w codziennej obsłudze klientów:
- centralna karta klienta (dane, opiekunowie, historia współpracy, dokumenty),
- zarządzanie umowami i waloryzacją stawek,
- alerty o terminach (90/60/30 dni),
- raporty KPI dla działań operacyjnych,
- asystent AI do szybkiego podsumowania i pytań o kontekst klienta.

## 🎯 Zakres MVP

1. Karta klienta z historią działań i dokumentami.
2. Obsługa umów, stawek i waloryzacji.
3. Alerty o kończących się umowach i zaległych waloryzacjach.
4. Prosty moduł raportowy (30/60/90 dni + status waloryzacji).
5. Integracja AI: podsumowanie klienta + chat po dokumentach.

## 🧱 Architektura (kierunek)

| Obszar | Odpowiedzialność |
| --- | --- |
| API (Python) | logika biznesowa CRM, role, workflow umów, alerty |
| PostgreSQL | dane relacyjne + elastyczne pola `JSONB` (`additional_data`) |
| Warstwa AI | LLM (phi 3.5 na Ollama), wektoryzacja dokumentów, odpowiedzi kontekstowe |
| Integracje | Active Directory (autoryzacja), dane inflacyjne (np. GUS) |

## 🛠️ Stack technologiczny

- **Backend:** Python (**FastAPI** lub **Django** — decyzja projektowa), REST API
- **Baza danych:** PostgreSQL, JSONB, rozważane `pgvector` / Chroma / Qdrant
- **AI/LLM:** phi 3.5 uruchamiany lokalnie przez Ollama
- **Infrastruktura:** środowisko intranetowe z Active Directory (SSO/LDAP do doprecyzowania)

## 🧩 Kluczowe funkcjonalności

### Karta klienta
- dane firmy + osoby kontaktowe,
- przypisanie opiekunów i właściciela klienta,
- historia spotkań, maili, notatek i załączników,
- status klienta i szybkie podsumowanie AI.

### Umowy i waloryzacja
- model stawek i usług oparty o ERD (Customer, CustomerRate, Valorization, Service, Specialist),
- sugestie waloryzacji na podstawie danych inflacyjnych,
- wsparcie generowania aneksów/nowych wersji umów.

### Asystent AI
- pytania naturalne o klienta i umowę (RAG po dokumentach),
- wskazanie źródła odpowiedzi (dokument/strona),
- weryfikacja spójności danych pracownika na podstawie dokumentów.

### Alerty i raporty
- sekwencja powiadomień: 90 / 60 / 30 dni przed końcem umowy,
- alerty „do zrobienia” i „po terminie” dla waloryzacji,
- dashboard operacyjny „co dzisiaj zrobić?”.

## 🔐 Dostęp i bezpieczeństwo

- Brak klasycznej rejestracji — dostęp przez Active Directory.
- Onboarding oparty o konto AD i role systemowe.
- Uprawnienia per klient i per umowa.
- Pełny log audytowy zmian (stawki, terminy, reguły waloryzacji).

## 🔗 Powiązanie z Linear

- Projekt: `HRK`
- Powiązane zadania: planowanie roadmapy, analiza MVP i implementacja modułu CRM

## 🗺️ Roadmap (high-level)

1. Domknięcie decyzji technicznych (FastAPI/Django, baza wektorowa, AD).
2. Implementacja fundamentów CRM (model danych + karta klienta).
3. Workflow umów, stawek, waloryzacji i alertów.
4. Moduł raportowy + dashboard operacyjny.
5. Integracja AI (podsumowania, chat kontekstowy, walidacje dokumentów).

## 📌 Otwarte decyzje

- Ostateczny wybór frameworka backendowego.
- Zakres i sposób integracji z AD (LDAP/SSO).
- Docelowa baza wektorowa (`pgvector` vs Chroma/Qdrant).
- Finalny zestaw scenariuszy użycia wymaganych na prezentację.

---

Tworzone przez **AlfaTeam** · HRK CRM · ZZPJ 2025/2026
