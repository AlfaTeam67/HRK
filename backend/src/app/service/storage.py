"""Storage service abstraction for S3-compatible object storage."""

from app.config import settings
from app.utils.s3_client import S3ClientAdapter, S3ClientError


class StorageServiceError(Exception):
    """Raised when storage operation fails."""


class StorageService:
    """Handles object upload/delete and secure presigned URLs."""

    def __init__(self, adapter: S3ClientAdapter | None = None) -> None:
        self._adapter = adapter or S3ClientAdapter()
        self._bucket = settings.s3_bucket
        self._default_ttl = settings.document_presigned_url_ttl_seconds
        self._bucket_privacy_verified = False

    async def ensure_bucket_private(self) -> None:
        if not settings.s3_require_private_bucket:
            return
        if self._bucket_privacy_verified:
            return
        try:
            await self._adapter.assert_bucket_private(bucket=self._bucket)
            self._bucket_privacy_verified = True
        except S3ClientError as exc:
            raise StorageServiceError("Storage bucket is not private.") from exc

    async def upload_bytes(self, *, key: str, content: bytes, content_type: str) -> None:
        try:
            await self._adapter.put_object(
                bucket=self._bucket, key=key, body=content, content_type=content_type
            )
        except S3ClientError as exc:
            raise StorageServiceError("Failed to upload object") from exc

    async def delete_object(self, *, key: str) -> None:
        try:
            await self._adapter.delete_object(bucket=self._bucket, key=key)
        except S3ClientError as exc:
            raise StorageServiceError("Failed to delete object") from exc

    async def generate_download_url(self, *, key: str, expires_in: int | None = None) -> str:
        ttl = expires_in or self._default_ttl
        try:
            return await self._adapter.generate_get_presigned_url(
                bucket=self._bucket,
                key=key,
                expires_in=ttl,
            )
        except S3ClientError as exc:
            raise StorageServiceError("Failed to generate download URL") from exc

    async def generate_upload_url(
        self, *, key: str, content_type: str, expires_in: int | None = None
    ) -> str:
        ttl = expires_in or self._default_ttl
        try:
            return await self._adapter.generate_put_presigned_url(
                bucket=self._bucket,
                key=key,
                content_type=content_type,
                expires_in=ttl,
            )
        except S3ClientError as exc:
            raise StorageServiceError("Failed to generate upload URL") from exc
