"""Document service: validation, metadata, and storage orchestration."""

from __future__ import annotations

import logging
import re
import uuid
from pathlib import Path
from typing import Final
from uuid import UUID

from fastapi import BackgroundTasks, UploadFile
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import (
    DocumentError,
    DocumentNotFoundError,
    DocumentStorageError,
    DocumentValidationError,
)
from app.models.attachment import Attachment
from app.models.contract import Contract
from app.models.customer import Customer
from app.models.enums import DocumentType
from app.models.user import User
from app.repo.attachment import AttachmentRepository
from app.repo.contract import ContractRepository
from app.repo.customer import CustomerRepository
from app.repo.user import UserRepository
from app.service.document_processing import DocumentProcessingService
from app.service.storage import StorageService, StorageServiceError

ALLOWED_CONTENT_TYPES: Final[frozenset[str]] = frozenset(
    {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/jpeg",
        "image/png",
        "text/plain",
    }
)
ALLOWED_EXTENSIONS: Final[frozenset[str]] = frozenset(
    {".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".txt"}
)
FILENAME_SANITIZER_RE: Final[re.Pattern[str]] = re.compile(r"[^A-Za-z0-9._-]+")
logger = logging.getLogger(__name__)


class DocumentService:
    def __init__(
        self, session: AsyncSession, storage_service: StorageService | None = None
    ) -> None:
        self._session = session
        self._attachments = AttachmentRepository(session)
        self._customers = CustomerRepository(session)
        self._contracts = ContractRepository(session)
        self._users = UserRepository(session)
        self._storage = storage_service or StorageService()

    async def upload_document(
        self,
        *,
        file: UploadFile,
        document_type: DocumentType,
        company_id: UUID | None,
        customer_id: UUID | None,
        contract_id: UUID | None,
        uploaded_by: UUID,
        background_tasks: BackgroundTasks,
    ) -> Attachment:
        if customer_id is None and contract_id is None:
            raise DocumentValidationError("Document must be linked to a customer or a contract.")

        original_filename, content_type, content = await self._validate_upload_file(file)

        customer, contract = await self._resolve_relations(
            customer_id=customer_id, contract_id=contract_id
        )
        await self._get_requesting_user(uploaded_by)

        resolved_company_id = self._resolve_company_id(
            explicit_company_id=company_id,
            customer_company_id=customer.company_id if customer else None,
        )
        object_key = self._build_object_key(
            company_id=resolved_company_id, document_id=uuid.uuid4(), filename=original_filename
        )
        logger.info("Uploading document to object storage", extra={"s3_key": object_key})

        try:
            await self._storage.upload_bytes(
                key=object_key, content=content, content_type=content_type
            )
        except StorageServiceError as exc:
            raise DocumentStorageError("Could not store document in object storage.") from exc

        try:
            attachment = await self._attachments.create(
                {
                    "company_id": resolved_company_id,
                    "customer_id": customer.id if customer else None,
                    "contract_id": contract.id if contract else None,
                    "document_type": document_type,
                    "original_filename": original_filename,
                    "s3_bucket": settings.s3_bucket,
                    "s3_key": object_key,
                    "mime_type": content_type,
                    "file_size_bytes": len(content),
                    "uploaded_by": uploaded_by,
                }
            )
            await self._session.commit()
            await self._session.refresh(attachment)
            background_tasks.add_task(
                DocumentProcessingService().process,
                attachment.id,
                attachment.customer_id,
                content,
                content_type,
            )
            return attachment
        except SQLAlchemyError as exc:
            await self._session.rollback()
            logger.exception(
                "DB persistence failed after object upload, attempting S3 cleanup",
                extra={"s3_key": object_key},
            )
            try:
                await self._storage.delete_object(key=object_key)
            except StorageServiceError as cleanup_exc:
                logger.exception("S3 cleanup failed after DB error", extra={"s3_key": object_key})
                raise DocumentStorageError(
                    "Could not persist metadata and cleanup failed. Object may require manual cleanup."
                ) from cleanup_exc
            raise DocumentError("Could not persist document metadata.") from exc

    async def get_download_url(
        self, *, document_id: UUID, requester_user_id: UUID
    ) -> tuple[str, int]:
        attachment = await self._attachments.get(document_id)
        if not attachment:
            raise DocumentNotFoundError("Document not found.")
        await self._get_requesting_user(requester_user_id)

        try:
            url = await self._storage.generate_download_url(key=attachment.s3_key)
        except StorageServiceError as exc:
            raise DocumentStorageError("Could not generate secure download URL.") from exc

        return url, settings.document_presigned_url_ttl_seconds

    async def delete_document(self, *, document_id: UUID, requester_user_id: UUID) -> None:
        attachment = await self._attachments.get(document_id)
        if not attachment:
            raise DocumentNotFoundError("Document not found.")
        await self._get_requesting_user(requester_user_id)

        try:
            await self._storage.delete_object(key=attachment.s3_key)
        except StorageServiceError as exc:
            raise DocumentStorageError("Could not delete object from storage.") from exc

        await self._attachments.delete(document_id, soft=False)
        await self._session.commit()

    async def get_document(self, *, document_id: UUID, requester_user_id: UUID) -> Attachment:
        attachment = await self._attachments.get(document_id)
        if not attachment:
            raise DocumentNotFoundError("Document not found.")
        await self._get_requesting_user(requester_user_id)
        return attachment

    async def list_documents(
        self,
        *,
        company_id: UUID | None = None,
        customer_id: UUID | None = None,
        contract_id: UUID | None = None,
    ) -> list[Attachment]:
        filters = {}
        if company_id:
            filters["company_id"] = company_id
        if customer_id:
            filters["customer_id"] = customer_id
        if contract_id:
            filters["contract_id"] = contract_id
        return await self._attachments.list(**filters)

    async def _get_requesting_user(self, user_id: UUID) -> User:
        user = await self._users.get(user_id)
        if user is None:
            raise DocumentValidationError("Requesting user not found.")
        return user

    async def _resolve_relations(
        self, *, customer_id: UUID | None, contract_id: UUID | None
    ) -> tuple[Customer | None, Contract | None]:
        customer = await self._customers.get(customer_id) if customer_id else None
        if customer_id and customer is None:
            raise DocumentValidationError("Customer not found.")

        contract = await self._contracts.get(contract_id) if contract_id else None
        if contract_id and contract is None:
            raise DocumentValidationError("Contract not found.")

        if contract and customer and contract.customer_id != customer.id:
            raise DocumentValidationError("Contract does not belong to the provided customer.")

        if contract and customer is None:
            customer = await self._customers.get(contract.customer_id)
            if customer is None:
                raise DocumentValidationError("Contract has no valid customer relation.")

        return customer, contract

    @staticmethod
    def _normalize_filename(raw_filename: str | None) -> str:
        if not raw_filename:
            raise DocumentValidationError("Filename is required.")
        basename = Path(raw_filename).name
        normalized = FILENAME_SANITIZER_RE.sub("_", basename).strip("._")
        if not normalized:
            raise DocumentValidationError("Filename is invalid.")
        return normalized[:255]

    @staticmethod
    def _resolve_company_id(
        *, explicit_company_id: UUID | None, customer_company_id: UUID | None
    ) -> UUID | None:
        if (
            explicit_company_id
            and customer_company_id
            and explicit_company_id != customer_company_id
        ):
            raise DocumentValidationError("Company does not match linked customer.")
        return explicit_company_id or customer_company_id

    @staticmethod
    def _build_object_key(*, company_id: UUID | None, document_id: UUID, filename: str) -> str:
        company_part = str(company_id) if company_id else "unassigned"
        return f"companies/{company_part}/documents/{document_id}_{filename}"

    async def _validate_upload_file(self, file: UploadFile) -> tuple[str, str, bytes]:
        original_filename = self._normalize_filename(file.filename)
        content_type = (file.content_type or "").lower()
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise DocumentValidationError("File content type is not allowed.")

        extension = Path(original_filename).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise DocumentValidationError("File extension is not allowed.")

        self._validate_declared_size(file.headers.get("content-length"))

        content = await file.read()
        if not content:
            raise DocumentValidationError("File is empty.")
        if len(content) > settings.document_max_file_size_bytes:
            raise DocumentValidationError("File size exceeds allowed limit.")
        return original_filename, content_type, content

    @staticmethod
    def _validate_declared_size(content_length: str | None) -> None:
        if content_length is None:
            return
        try:
            declared_size = int(content_length)
        except ValueError as exc:
            raise DocumentValidationError("Invalid file content-length.") from exc
        if declared_size > settings.document_max_file_size_bytes:
            raise DocumentValidationError("File size exceeds allowed limit.")
