"""S3-compatible adapter (MinIO/AWS)."""

from __future__ import annotations

import asyncio

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.config import settings

PUBLIC_GRANTEE_URIS = {
    "http://acs.amazonaws.com/groups/global/AllUsers",
    "http://acs.amazonaws.com/groups/global/AuthenticatedUsers",
}


class S3ClientError(Exception):
    """Raised when S3-compatible operation fails."""


class S3ClientAdapter:
    """Thin async-friendly adapter over boto3 S3 client."""

    def __init__(self) -> None:
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            config=Config(signature_version="s3v4", s3={"addressing_style": "auto"}),
        )
        presign_endpoint = settings.s3_external_endpoint or settings.s3_endpoint
        self._presign_client = boto3.client(
            "s3",
            endpoint_url=presign_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            config=Config(signature_version="s3v4", s3={"addressing_style": "auto"}),
        )

    async def put_object(self, *, bucket: str, key: str, body: bytes, content_type: str) -> None:
        extra_args: dict[str, str] = {}
        if settings.s3_sse_enabled:
            extra_args["ServerSideEncryption"] = settings.s3_sse_algorithm
        try:
            await asyncio.to_thread(
                self._client.put_object,
                Bucket=bucket,
                Key=key,
                Body=body,
                ContentType=content_type,
                **extra_args,
            )
        except (ClientError, BotoCoreError) as exc:
            raise S3ClientError("S3 upload failed") from exc

    async def delete_object(self, *, bucket: str, key: str) -> None:
        try:
            await asyncio.to_thread(self._client.delete_object, Bucket=bucket, Key=key)
        except (ClientError, BotoCoreError) as exc:
            raise S3ClientError("S3 delete failed") from exc

    async def generate_get_presigned_url(self, *, bucket: str, key: str, expires_in: int) -> str:
        try:
            return await asyncio.to_thread(
                self._presign_client.generate_presigned_url,
                "get_object",
                Params={"Bucket": bucket, "Key": key},
                ExpiresIn=expires_in,
            )
        except (ClientError, BotoCoreError) as exc:
            raise S3ClientError("S3 download URL generation failed") from exc

    async def generate_put_presigned_url(
        self, *, bucket: str, key: str, content_type: str, expires_in: int
    ) -> str:
        params = {"Bucket": bucket, "Key": key, "ContentType": content_type}
        if settings.s3_sse_enabled:
            params["ServerSideEncryption"] = settings.s3_sse_algorithm
        try:
            return await asyncio.to_thread(
                self._presign_client.generate_presigned_url,
                "put_object",
                Params=params,
                ExpiresIn=expires_in,
            )
        except (ClientError, BotoCoreError) as exc:
            raise S3ClientError("S3 upload URL generation failed") from exc

    async def assert_bucket_private(self, *, bucket: str) -> None:
        try:
            acl = await asyncio.to_thread(self._client.get_bucket_acl, Bucket=bucket)
        except (ClientError, BotoCoreError) as exc:
            raise S3ClientError("Could not verify bucket privacy.") from exc

        grants = acl.get("Grants", [])
        for grant in grants:
            grantee = grant.get("Grantee", {})
            uri = grantee.get("URI")
            if isinstance(uri, str) and uri in PUBLIC_GRANTEE_URIS:
                raise S3ClientError("Bucket must not expose public read/write access.")
