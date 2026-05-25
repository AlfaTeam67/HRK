# Storage — MinIO (S3-compatible)

## Cel

Pokazać, jak przechowujemy pliki (umowy, aneksy, pisma) w **MinIO** —
private bucket z SSE i presigned URL. Plik łączy się z
[`../auth/permissions.md`](../auth/permissions.md) i
[`../workflows/document-upload.md`](../workflows/document-upload.md).

> Streszczenie + rozwinięcie oryginalnego `docs/s3-security-design.md`.

---

## Dlaczego MinIO

- **S3-compatible** — taki sam API jak AWS S3 (boto3 działa).
- Lokalna instalacja w Dockerze, brak chmury w MVP.
- Można zamienić 1:1 na AWS S3 / Azure Blob / GCS bez zmian w kodzie.

---

## Decyzje (krótko)

1. **Private bucket** — tylko backend + presigned URL.
2. **SSE-S3 (AES256)** — szyfrowanie obiektów po stronie MinIO.
3. **Presigned URL** TTL 5 min (`DOCUMENT_PRESIGNED_URL_TTL_SECONDS=300`).
4. **TLS** — wyłączone w MVP (localhost). Wymagane przy wyjściu poza
   localhost.
5. **`s3_require_private_bucket=true`** — backend weryfikuje przy starcie
   (lifespan), że bucket nie ma public access.

---

## Konfiguracja

`.env`:
```env
S3_ENDPOINT=http://localhost:9000        # backend → MinIO
S3_EXTERNAL_ENDPOINT=http://localhost:9000  # FE → MinIO (presigned URL)
S3_BUCKET=hrk-documents
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_REGION=us-east-1
S3_SSE_ENABLED=true
S3_SSE_ALGORITHM=AES256
S3_REQUIRE_PRIVATE_BUCKET=true
DOCUMENT_MAX_FILE_SIZE_BYTES=10485760    # 10 MB
DOCUMENT_PRESIGNED_URL_TTL_SECONDS=300   # 5 min
```

> W docker-compose backend widzi MinIO pod `http://minio:9000` (sieć
> wewnętrzna), a FE pod `http://localhost:9000` (przeglądarka). Stąd
> dwa endpointy: `S3_ENDPOINT` (BE→S3) i `S3_EXTERNAL_ENDPOINT` (do
> generowania presigned URL widocznych przez FE).

---

## docker-compose

```yaml
minio:
  image: minio/minio:latest
  command: server /data --console-address ":9001"
  ports:
    - "9000:9000"      # API S3
    - "9001:9001"      # konsola web
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin
  healthcheck:
    test: ["CMD-SHELL", "curl -sf http://localhost:9000/minio/health/live"]

minio-init:
  image: minio/mc:latest
  depends_on: { minio: { condition: service_healthy } }
  entrypoint: >
    /bin/sh -c "
      mc alias set local http://minio:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD} &&
      mc mb --ignore-existing local/${S3_BUCKET:-hrk-documents}
    "
  restart: "no"
```

> `minio-init` startuje raz po `minio`, tworzy bucket, kończy się.
> Jeśli bucket już istnieje, `mc mb --ignore-existing` to no-op.

Konsola: http://localhost:9001 (`minioadmin` / `minioadmin`).

---

## Klient po stronie backendu

`backend/src/app/utils/s3_client.py` — `S3ClientAdapter` (boto3 async
przez `aioboto3` lub bezpośrednie wrapowanie w threadpool).

`StorageService` (`app/service/storage.py`) jest abstrakcją:

```python
class StorageService:
    async def ensure_bucket_private(self) -> None
    async def upload_bytes(self, *, key, content, content_type) -> None
    async def delete_object(self, *, key) -> None
    async def generate_download_url(self, *, key, expires_in=None) -> str
    async def get_object_bytes(self, *, key) -> tuple[bytes, str]
    async def generate_upload_url(self, *, key, content_type, expires_in=None) -> str
```

Wszystkie błędy zawijają `S3ClientError → StorageServiceError`. Wyższa
warstwa (`DocumentService`) zamienia to na `DocumentStorageError → 502`.

---

## Konwencja kluczy S3

```
companies/{company_id}/{document_id}_{sanitized_filename}
companies/{company_id}/generated/{uuid}_aneks_X_DRAFT.pdf
companies/{company_id}/generated/{uuid}_aneks_X_FINAL.pdf
```

Algorytm:
1. Sanitize filename: `[^A-Za-z0-9._-]+` → `_`.
2. Prefix po `company_id` (resolve z `customer.company_id`, jeśli
   nie podany explicit).
3. Document UUID prepended → unikalne klucze nawet dla tej samej nazwy.

`s3_key` jest **UNIQUE** w tabeli `attachments`.

---

## Lifespan check

```python
# main.py
@asynccontextmanager
async def lifespan(_app):
    print(f"Starting up {settings.app_name}...")
    await get_storage_service().ensure_bucket_private()
    yield
```

`ensure_bucket_private()` weryfikuje, że bucket nie jest publiczny. Jeśli
`s3_require_private_bucket=true` i bucket jest publiczny → start
przerwany. Sprawdzenie wykonuje się **raz** per process.

---

## Upload bytes

```python
# StorageService.upload_bytes
await self._adapter.put_object(
    bucket=self._bucket,
    key=key,
    body=content,
    content_type=content_type,
    # SSE: ServerSideEncryption=AES256 jest dorzucane przez adapter
)
```

Limit po stronie backendu: `DOCUMENT_MAX_FILE_SIZE_BYTES` (10 MB).
Walidacja w `DocumentService._validate_upload_file` jeszcze przed `put`.

---

## Presigned URL

### Pobranie (GET)
```python
url = await storage.generate_download_url(key=key, expires_in=300)
# → https://minio.../bucket/key?X-Amz-Signature=...&X-Amz-Expires=300
```

Frontend dostaje `{ url, expires_in }` z endpointu
`/api/v1/documents/{id}/download-url` i pobiera plik bezpośrednio z MinIO.

### Upload (PUT) — zarezerwowane
`StorageService.generate_upload_url` jest dostępny, ale obecny flow
uploadu idzie **przez backend** (`POST /api/v1/documents` multipart).
Powód: walidacja MIME/size + audyt + atomowy commit do DB.

---

## Stream przez backend

Alternatywa do presigned URL:

```
GET /api/v1/documents/{id}/stream?requester_user_id={uid}
→ backend pobiera bajty z MinIO i zwraca strumieniem
```

Sytuacje, gdy ma sens:
- Trzeba zlogować, kto pobrał plik (`audit_logs`).
- Trzeba post-processingu (np. watermark live).
- Frontend nie ma bezpośredniego dostępu do MinIO (np. inny VPC).

Koszt: bajty lecą **przez backend**, nie peer-to-peer. Dla dużych
plików — wolniejsze.

---

## Bezpieczeństwo

| Wektor | Mitigacja |
|---|---|
| Listing bucketu z internetu | Private bucket, listing zablokowany. |
| Wyciek klucza S3 | Presigned URL → 5 min TTL. |
| Manipulacja MIME | Walidacja allow-list (PDF/DOCX/JPG/PNG/TXT). |
| Plik > 10 MB | Walidacja w `DocumentService._validate_upload_file`. |
| Rogue user pobiera cudze pliki | TODO: weryfikacja `requester_user_id` ↔ `attachment.customer/contract`. Obecnie endpoint to wymaga, ale nie wszędzie sprawdza. |
| Wyciek treści | SSE-S3 + planowane w pełnym wdrożeniu: HTTPS na MinIO. |

---

## Co później

- TLS na MinIO (LetsEncrypt + Caddy / Traefik).
- SSE-KMS zamiast SSE-S3 (zewnętrzny KMS, rotacja kluczy).
- Pełen audit log dostępów (każde wygenerowanie presigned URL =
  wpis `audit_logs.action=VIEW`).
- Lifecycle rules — auto-delete draftów AI po 30 dniach.

---

## Dalej

- [`../workflows/document-upload.md`](../workflows/document-upload.md) —
  pełny flow od FE do MinIO + chunking + RAG.
- Oryginalny design: [`/docs/s3-security-design.md`](../../docs/s3-security-design.md).
