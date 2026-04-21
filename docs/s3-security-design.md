# S3/MinIO — Security Design (localhost)

## Cel

Chronić wrażliwe dokumenty (umowy, aneksy, pisma) trzymane w MinIO, bez komplikowania lokalnego środowiska projektu.

---

## Decyzje (krótko)

1. **SSE w MinIO: TAK**  
   Pliki są szyfrowane „na dysku” po stronie MinIO.
2. **Private bucket: TAK**  
   Bucket nie jest publiczny, dostęp tylko przez backend i konta serwisowe.
3. **Presigned URL: TAK**  
   Frontend dostaje tylko tymczasowy link do konkretnego pliku (np. 1–5 min).
4. **TLS: NIE na ten moment**  
   Aplikacja działa wyłącznie na localhost. Gdyby wyszła poza localhost/VPN, TLS staje się wymagany.

---

## Flow — od uploadu do odczytu

```
Upload pliku
  → backend zapisuje do private bucket
  → MinIO zapisuje obiekt zaszyfrowany (SSE)

Odczyt pliku (UI / podgląd)
  → frontend prosi backend o dostęp
  → backend sprawdza uprawnienia użytkownika
  → backend generuje presigned URL (krótki TTL)
  → frontend pobiera plik przez ten tymczasowy link

RAG/OCR
  → backend/worker czyta plik z MinIO na uprawnieniach serwisowych
  → MinIO odszyfrowuje obiekt transparentnie po autoryzacji
  → reszta pipeline RAG bez zmian
```

---

## Wpływ na RAG

- **Wyszukiwanie wektorowe i embeddingi: bez zmian** (to dzieje się po odczycie dokumentu).
- **Zmiana dotyczy dostępu do pliku**: tylko autoryzowany backend/worker oraz czasowe linki.
- **Ważne**: wrażliwe dane są też w bazie (`document_chunks.content`), więc trzeba pilnować uprawnień i backupów.

---

## Minimalny standard dla tego projektu (teraz)

- prywatny bucket,
- szyfrowanie SSE w MinIO,
- krótkie presigned URL,
- brak publicznych linków „na stałe”,

---

## Co później (jeśli projekt wyjdzie poza localhost)

- włączyć TLS end-to-end,
- rozważyć SSE-KMS (zewnętrzne zarządzanie kluczami i rotacja),
- dodać pełny audyt dostępu do obiektów.
