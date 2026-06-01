from __future__ import annotations

from uuid import UUID, uuid4

import boto3
import pytest
from fastapi import Depends
from httpx import AsyncClient
from moto import mock_aws
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.documents import get_document_service
from app.config import settings
from app.core.database import AsyncSessionLocal, get_db
from app.main import app
from app.models.activity import ActivityLog
from app.models.customer import Customer
from app.models.document_chunk import DocumentChunk
from app.models.enums import ActivityType, CustomerStatus, OcrStatus
from app.models.user import User
from app.repo.attachment import AttachmentRepository
from app.service.document import DocumentService
from app.service.storage import StorageService
from app.utils.s3_client import S3ClientAdapter


async def _create_user_and_customer() -> tuple[UUID, UUID]:
    async with AsyncSessionLocal() as session:
        user = User(
            login=f"user_{uuid4().hex[:12]}",
            email=f"user_{uuid4().hex[:12]}@example.com",
        )
        session.add(user)
        await session.flush()

        customer = Customer(
            ckk=uuid4().hex[:10],
            account_manager_id=user.id,
            status=CustomerStatus.ACTIVE,
        )
        session.add(customer)
        await session.commit()
        return user.id, customer.id


@pytest.mark.asyncio
async def test_upload_document_persists_s3_and_db(client: AsyncClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "s3_endpoint", None)
    monkeypatch.setattr(settings, "s3_access_key", "test")
    monkeypatch.setattr(settings, "s3_secret_key", "test")

    with mock_aws():
        s3 = boto3.client("s3", region_name=settings.s3_region)
        s3.create_bucket(Bucket=settings.s3_bucket)

        storage_service = StorageService(adapter=S3ClientAdapter())
        await storage_service.ensure_bucket_private()

        async def override_document_service(db: AsyncSession = Depends(get_db)) -> DocumentService:
            return DocumentService(db, storage_service=storage_service)

        app.dependency_overrides[get_document_service] = override_document_service

        try:
            user_id, customer_id = await _create_user_and_customer()

            response = await client.post(
                "/api/v1/documents/",
                files={"file": ("contract.pdf", b"%PDF-1.4 test", "application/pdf")},
                data={
                    "document_type": "contract",
                    "customer_id": str(customer_id),
                    "uploaded_by": str(user_id),
                },
            )

            assert response.status_code == 201
            payload = response.json()
            assert "id" in payload
            assert payload["s3_key"]

            document_id = UUID(payload["id"])
            s3_key = payload["s3_key"]

            async with AsyncSessionLocal() as session:
                saved_attachment = await AttachmentRepository(session).get(document_id)
                assert saved_attachment is not None
                assert saved_attachment.customer_id == customer_id
                assert saved_attachment.uploaded_by == user_id
                assert saved_attachment.s3_key == s3_key

            s3_object = s3.head_object(Bucket=settings.s3_bucket, Key=s3_key)
            assert s3_object["ContentLength"] > 0

            # Test streaming
            stream_response = await client.get(
                f"/api/v1/documents/{document_id}/stream",
                params={"requester_user_id": str(user_id)},
            )
            assert stream_response.status_code == 200
            assert stream_response.content == b"%PDF-1.4 test"
            assert stream_response.headers["content-type"] == "application/pdf"
            assert stream_response.headers["content-disposition"] == "inline"
        finally:
            app.dependency_overrides.pop(get_document_service, None)


@pytest.mark.asyncio
async def test_upload_with_ai_assistant_disabled_skips_processing(
    client: AsyncClient, monkeypatch
) -> None:
    """When user unchecks the AI checkbox, ocr_status=skipped and no background
    indexing happens."""
    monkeypatch.setattr(settings, "s3_endpoint", None)
    monkeypatch.setattr(settings, "s3_access_key", "test")
    monkeypatch.setattr(settings, "s3_secret_key", "test")

    with mock_aws():
        s3 = boto3.client("s3", region_name=settings.s3_region)
        s3.create_bucket(Bucket=settings.s3_bucket)

        storage_service = StorageService(adapter=S3ClientAdapter())
        await storage_service.ensure_bucket_private()

        async def override_document_service(db: AsyncSession = Depends(get_db)) -> DocumentService:
            return DocumentService(db, storage_service=storage_service)

        app.dependency_overrides[get_document_service] = override_document_service

        try:
            user_id, customer_id = await _create_user_and_customer()

            response = await client.post(
                "/api/v1/documents/",
                files={"file": ("doc.pdf", b"%PDF-1.4 test", "application/pdf")},
                data={
                    "document_type": "contract",
                    "customer_id": str(customer_id),
                    "uploaded_by": str(user_id),
                    "include_in_ai_assistant": "false",
                },
            )

            assert response.status_code == 201
            payload = response.json()
            assert payload["include_in_ai_assistant"] is False
            assert payload["ocr_status"] == "skipped"
        finally:
            app.dependency_overrides.pop(get_document_service, None)


@pytest.mark.asyncio
async def test_toggle_ai_assistant_off_deletes_chunks_and_logs_activity(
    client: AsyncClient, monkeypatch
) -> None:
    """Disabling AI on a document removes its chunks and writes an activity log."""
    monkeypatch.setattr(settings, "s3_endpoint", None)
    monkeypatch.setattr(settings, "s3_access_key", "test")
    monkeypatch.setattr(settings, "s3_secret_key", "test")

    with mock_aws():
        s3 = boto3.client("s3", region_name=settings.s3_region)
        s3.create_bucket(Bucket=settings.s3_bucket)

        storage_service = StorageService(adapter=S3ClientAdapter())
        await storage_service.ensure_bucket_private()

        async def override_document_service(db: AsyncSession = Depends(get_db)) -> DocumentService:
            return DocumentService(db, storage_service=storage_service)

        app.dependency_overrides[get_document_service] = override_document_service

        try:
            user_id, customer_id = await _create_user_and_customer()

            # Upload (default include_in_ai_assistant=true)
            upload = await client.post(
                "/api/v1/documents/",
                files={"file": ("doc.pdf", b"%PDF-1.4 test", "application/pdf")},
                data={
                    "document_type": "contract",
                    "customer_id": str(customer_id),
                    "uploaded_by": str(user_id),
                },
            )
            assert upload.status_code == 201
            doc_id = UUID(upload.json()["id"])

            # Inject a fake chunk to verify deletion
            async with AsyncSessionLocal() as session:
                chunk = DocumentChunk(
                    attachment_id=doc_id,
                    customer_id=customer_id,
                    chunk_index=0,
                    content="some text",
                    token_count=2,
                    embedding=[0.0] * 768,
                )
                session.add(chunk)
                await session.commit()

            # Toggle OFF
            response = await client.patch(
                f"/api/v1/documents/{doc_id}/ai-assistant",
                params={"requester_user_id": str(user_id)},
                json={"enabled": False},
            )
            assert response.status_code == 202
            body = response.json()
            assert body["include_in_ai_assistant"] is False

            # Verify chunks gone + ActivityLog written
            async with AsyncSessionLocal() as session:
                from sqlalchemy import select

                chunks = (
                    await session.execute(
                        select(DocumentChunk).where(DocumentChunk.attachment_id == doc_id)
                    )
                ).scalars().all()
                assert len(chunks) == 0

                activities = (
                    await session.execute(
                        select(ActivityLog).where(
                            ActivityLog.activity_type == ActivityType.DOCUMENT,
                            ActivityLog.customer_id == customer_id,
                        )
                    )
                ).scalars().all()
                assert any(
                    a.additional_data.get("attachment_id") == str(doc_id)
                    and a.additional_data.get("include_in_ai_assistant") is False
                    for a in activities
                )

            # Idempotent: second OFF returns same state, no double-logging
            response2 = await client.patch(
                f"/api/v1/documents/{doc_id}/ai-assistant",
                params={"requester_user_id": str(user_id)},
                json={"enabled": False},
            )
            assert response2.status_code == 202
            assert response2.json()["include_in_ai_assistant"] is False
        finally:
            app.dependency_overrides.pop(get_document_service, None)


@pytest.mark.asyncio
async def test_toggle_ai_assistant_on_unsupported_mime_marks_unsupported(
    client: AsyncClient, monkeypatch
) -> None:
    """Toggling ON for a DOCX (unsupported) keeps include=true but flags
    unsupported_format=true and ocr_status=skipped."""
    monkeypatch.setattr(settings, "s3_endpoint", None)
    monkeypatch.setattr(settings, "s3_access_key", "test")
    monkeypatch.setattr(settings, "s3_secret_key", "test")

    with mock_aws():
        s3 = boto3.client("s3", region_name=settings.s3_region)
        s3.create_bucket(Bucket=settings.s3_bucket)

        storage_service = StorageService(adapter=S3ClientAdapter())
        await storage_service.ensure_bucket_private()

        async def override_document_service(db: AsyncSession = Depends(get_db)) -> DocumentService:
            return DocumentService(db, storage_service=storage_service)

        app.dependency_overrides[get_document_service] = override_document_service

        try:
            user_id, customer_id = await _create_user_and_customer()

            upload = await client.post(
                "/api/v1/documents/",
                files={
                    "file": (
                        "report.docx",
                        b"PK\x03\x04 fake docx",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    )
                },
                data={
                    "document_type": "other",
                    "customer_id": str(customer_id),
                    "uploaded_by": str(user_id),
                    "include_in_ai_assistant": "false",
                },
            )
            assert upload.status_code == 201
            doc_id = UUID(upload.json()["id"])

            response = await client.patch(
                f"/api/v1/documents/{doc_id}/ai-assistant",
                params={"requester_user_id": str(user_id)},
                json={"enabled": True},
            )
            assert response.status_code == 202
            body = response.json()
            assert body["include_in_ai_assistant"] is True
            assert body["unsupported_format"] is True
            assert body["ocr_status"] == "skipped"
        finally:
            app.dependency_overrides.pop(get_document_service, None)
