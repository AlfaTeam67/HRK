# AD / Auto-login — Design i ryzyka (MVP)

## Cel

Zasymulować (lub odtworzyć) zachowanie „jak w firmowym AD”:
- użytkownik loguje się do systemu operacyjnego kontem domenowym,
- wchodzi na HRK i jest rozpoznany automatycznie,
- role w HRK wynikają z tożsamości/grup, nie z lokalnego hasła aplikacji.

---

## Oczekiwane zachowanie (docelowe)

```
Jan loguje się do Windows (konto domenowe)
  → otwiera HRK w przeglądarce
  → przeglądarka wysyła Kerberos ticket (SPNEGO)
  → warstwa auth (proxy / serwer) weryfikuje ticket
  → backend dostaje tożsamość np. HRK\jkowalski
  → backend mapuje usera/grupy na role w HRK
  → Jan jest zalogowany bez wpisywania hasła w HRK
```

To jest klasyczne **Windows Integrated Authentication**.

---

## Co jest ważne

- `whoami` na komputerze użytkownika **nie jest mechanizmem logowania web app**.
- Backend **nie ma dostępu do terminala użytkownika**.
- Tożsamość musi pochodzić z **zaufanego protokołu** (Kerberos/SSO), nie z danych wysłanych przez frontend.

---

## Czy Keycloak sam to załatwi?

**Nie w 100%.**  
Keycloak z lokalnymi userami daje normalny ekran logowania (login/hasło).  
Zachowanie „bez ekranu logowania” wymaga spięcia z domeną/kerberos i konfiguracji środowiska.

---

## Opcje „fake AD” dla projektu

## Opcja A — „najbliżej prawdziwego AD” (rekomendacja techniczna)

Lokalne labowe środowisko domenowe + Kerberos:
- Samba AD DC (domena testowa),
- przeglądarka i hosty skonfigurowane do SPNEGO/Kerberos,
- reverse proxy (np. Nginx/Apache) weryfikujące ticket,
- backend dostaje zaufaną tożsamość (`REMOTE_USER` / bezpieczny header od proxy).

**Plusy:** najbardziej realistyczne zachowanie auto-login.  
**Minusy:** trudniejszy setup infra, więcej punktów awarii.

## Opcja B — „połowiczny fake”

Keycloak/OIDC + użytkownicy i grupy jak w AD, ale z ekranem logowania.  

**Plusy:** szybkie MVP, prostsze utrzymanie.  
**Minusy:** brak prawdziwego auto-login z sesji systemowej.

## Opcja C — „dev mock” (tylko lokalne testy UI)

Tryb developerski: backend przyjmuje wymuszony użytkownik z lokalnej konfiguracji (np. `DEV_AUTH_USER=jkowalski`), bez prawdziwej federacji.

**Plusy:** najszybsze do developmentu ekranów i ról.  
**Minusy:** to nie jest SSO/AD, nie wolno traktować jako rozwiązanie produkcyjne.

---

## Główne problemy i ograniczenia

1. **Browser + intranet constraints**  
   Auto-login działa poprawnie głównie na urządzeniach w domenie i z poprawnie ustawioną przeglądarką.

2. **localhost constraints**  
   Czysty `localhost` często nie oddaje realnych warunków Kerberos (SPN, trusted host, DNS).

3. **Zaufanie do nagłówków**  
   Backend nie może ufać `X-User` z internetu. Tylko zaufane proxy i odcięcie bezpośredniego ruchu do API.

4. **Role biznesowe**  
   AD/Kerberos mówi „kto to jest”, ale nie rozwiązuje pełnej autoryzacji domenowej w HRK (co wolno w kontekście klienta/umowy).

5. **Urządzenia spoza domeny**  
   Potrzebny fallback (np. OIDC login + MFA, VPN, ograniczenie dostępu).

---

## Minimalna architektura dla HRK (gdy chcemy auto-login)

```
Browser (domena)
  → Reverse Proxy (SPNEGO/Kerberos auth)
  → FastAPI (trust only proxy identity)
  → PostgreSQL (role biznesowe, mapowanie usera)
```

Ważne:
- API nie powinno być wystawione „bokiem” z pominięciem proxy auth.
- Tożsamość z proxy musi być podpisana zaufaniem sieciowym (nie z frontendu).

---

## Praktyczny scenariusz testowy (Linux host + Windows VM)

Możliwy i sensowny wariant dla projektu:

1. HRK działa na Linuxie (np. Docker na hoście).
2. Windows VM jest dołączony do domeny testowej.
3. Z Windows VM wchodzimy na HRK po **IP/nazwie hosta Linuxa**, nie po `localhost`.
4. Reverse proxy przed FastAPI obsługuje SPNEGO/Kerberos i przekazuje zaufaną tożsamość.

Warunki, żeby to działało:
- poprawny DNS/SPN dla adresu HRK,
- synchronizacja czasu (Kerberos jest na to bardzo wrażliwy),
- konfiguracja przeglądarki jako strefa intranet/trusted,
- brak możliwości ominięcia proxy auth i wejścia do API „na skróty”.

---

## Co możemy zrobić „fakowo”, ale sensownie

Dla zajęć/prototypu warto przygotować 2 poziomy:

1. **Dev mode (szybki):** mock user + mapowanie ról (żeby budować funkcje aplikacji).
2. **Demo mode (realistyczny):** mini-lab Kerberos/SPNEGO na osobnej konfiguracji, pokazujący auto-login.

To daje szybki development i jednocześnie prezentowalne „prawie AD”.

---

## Flaga `.env` do bypassu AD (tylko dev)

Możemy dodać przełącznik środowiskowy:

```env
AUTH_SKIP_AD=true
AUTH_DEV_USER=admin
AUTH_DEV_ROLE=admin
```

Zachowanie:
- `AUTH_SKIP_AD=true` → backend pomija AD/Kerberos i loguje jako `AUTH_DEV_USER`.
- `AUTH_SKIP_AD=false` → backend używa pełnego flow AD/Kerberos.

Warunki bezpieczeństwa:
- bypass dozwolony wyłącznie w dev/local,
- w `DEBUG=false` bypass powinien być blokowany,
- przy starcie aplikacja powinna logować ostrzeżenie, że auth bypass jest aktywny,
- środowiska demo/produkcyjne nie mogą mieć `AUTH_SKIP_AD=true`.

---

## Pytania otwarte do doprecyzowania

1. Czy celem jest **pełne auto-login** na prezentacji, czy wystarczy „AD-like” z ekranem logowania?
2. Czy demo ma działać tylko na jednym hostie, czy na wielu komputerach użytkowników?
3. Czy mamy zasoby na postawienie mini-domeny testowej (Samba AD DC)?
4. Jakie grupy/role biznesowe HRK chcemy mapować z tożsamości?
5. Co robimy z urządzeniami spoza domeny (brak auto-login)?

---

## Rekomendacja dla tego repo (MVP)

- Jeśli priorytetem jest **realizm AD**: iść w Opcję A (mini-lab Kerberos/SPNEGO).
- Jeśli priorytetem jest **tempo dowiezienia funkcji CRM/RAG**: robić Opcję B/C teraz, a A jako rozszerzenie demonstracyjne.

W obu przypadkach zachować jedną zasadę:  
**tożsamość użytkownika ma pochodzić z zaufanego mechanizmu serwerowego, nigdy z danych deklarowanych przez frontend.**
