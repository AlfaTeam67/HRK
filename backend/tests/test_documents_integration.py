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
from app.models.customer import Customer
from app.models.enums import CustomerStatus
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
        finally:
            app.dependency_overrides.pop(get_document_service, None)
