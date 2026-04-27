"""Storage dependencies with application-level lifecycle."""

from functools import lru_cache

from app.service.storage import StorageService
from app.utils.s3_client import S3ClientAdapter


@lru_cache
def get_s3_client_adapter() -> S3ClientAdapter:
    """Return singleton S3 adapter for the app process."""
    return S3ClientAdapter()


@lru_cache
def get_storage_service() -> StorageService:
    """Return singleton storage service for the app process."""
    return StorageService(adapter=get_s3_client_adapter())
