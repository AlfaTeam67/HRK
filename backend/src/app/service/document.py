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
from app.models.enums import ActivityType, DocumentType, OcrStatus
from app.models.user import User
from app.repo.activity import ActivityLogRepository
from app.repo.attachment import AttachmentRepository
from app.repo.contract import ContractRepository
from app.repo.customer import CustomerRepository
from app.repo.document_chunk import DocumentChunkRepository
from app.repo.user import UserRepository
from app.schemas.document import AiAssistantBulkItemResult
from app.service.document_processing import (
    DocumentProcessingService,
    is_processable_mime,
)
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
        self._chunks = DocumentChunkRepository(session)
        self._customers = CustomerRepository(session)
        self._contracts = ContractRepository(session)
        self._users = UserRepository(session)
        self._activity = ActivityLogRepository(session)
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
        include_in_ai_assistant: bool = True,
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

        # Decide initial OCR status: if the user opted out of AI indexing or the
        # MIME type is not processable, we mark as SKIPPED and never enqueue
        # processing. Otherwise default to PENDING and schedule the background
        # task after commit.
        will_process = include_in_ai_assistant and is_processable_mime(content_type)
        initial_status = OcrStatus.PENDING if will_process else OcrStatus.SKIPPED

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
                    "include_in_ai_assistant": include_in_ai_assistant,
                    "ocr_status": initial_status,
                }
            )
            await self._session.commit()
            await self._session.refresh(attachment)
            if will_process:
                background_tasks.add_task(
                    DocumentProcessingService().process,
                    attachment.id,
                    attachment.customer_id,
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

    async def stream_document_bytes(
        self, *, document_id: UUID, requester_user_id: UUID
    ) -> tuple[bytes, str]:
        attachment = await self._attachments.get(document_id)
        if not attachment:
            raise DocumentNotFoundError("Document not found.")
        await self._get_requesting_user(requester_user_id)
        try:
            content, content_type = await self._storage.get_object_bytes(key=attachment.s3_key)
        except StorageServiceError as exc:
            raise DocumentStorageError("Could not retrieve document from storage.") from exc
        return content, content_type

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
        exclude_draft: bool = False,
        include_in_ai_assistant_only: bool = False,
    ) -> list[Attachment]:
        if exclude_draft:
            attachments = list(
                await self._attachments.list_excluding_status(
                    customer_id=customer_id,
                    contract_id=contract_id,
                    company_id=company_id,
                    excluded_status=OcrStatus.SKIPPED,
                    include_in_ai_assistant=True if include_in_ai_assistant_only else None,
                )
            )
        else:
            filters: dict = {}
            if company_id:
                filters["company_id"] = company_id
            if customer_id:
                filters["customer_id"] = customer_id
            if contract_id:
                filters["contract_id"] = contract_id
            if include_in_ai_assistant_only:
                filters["include_in_ai_assistant"] = True
            attachments = list(await self._attachments.list(**filters))

        return attachments

    async def set_ai_assistant_enabled(
        self,
        *,
        document_id: UUID,
        enabled: bool,
        requester_user_id: UUID,
        background_tasks: BackgroundTasks,
    ) -> tuple[Attachment, bool]:
        """Toggle whether a document is searchable by the AI assistant.

        Returns ``(attachment, unsupported_format)``. The second flag is
        ``True`` when the user requested ``enabled=True`` but the document's
        MIME type is not processable — the intent is recorded, but no
        embedding will happen.
        """
        attachment = await self._attachments.get(document_id)
        if attachment is None:
            raise DocumentNotFoundError("Document not found.")
        await self._get_requesting_user(requester_user_id)

        return await self._toggle_ai_for_attachment(
            attachment=attachment,
            enabled=enabled,
            requester_user_id=requester_user_id,
            background_tasks=background_tasks,
        )

    async def _toggle_ai_for_attachment(
        self,
        *,
        attachment: Attachment,
        enabled: bool,
        requester_user_id: UUID,
        background_tasks: BackgroundTasks,
    ) -> tuple[Attachment, bool]:
        """Core toggle logic operating on an already-fetched attachment."""
        unsupported = False
        previous_enabled = bool(attachment.include_in_ai_assistant)
        if enabled == previous_enabled:
            return attachment, not is_processable_mime(attachment.mime_type) and enabled

        if enabled:
            attachment.include_in_ai_assistant = True
            if is_processable_mime(attachment.mime_type):
                attachment.ocr_status = OcrStatus.PENDING
                await self._record_ai_toggle_activity(
                    attachment=attachment,
                    performed_by=requester_user_id,
                    enabled=enabled,
                    unsupported=False,
                )
                await self._session.commit()
                await self._session.refresh(attachment)
                background_tasks.add_task(
                    DocumentProcessingService().process,
                    attachment.id,
                    attachment.customer_id,
                )
            else:
                attachment.ocr_status = OcrStatus.SKIPPED
                unsupported = True
                await self._record_ai_toggle_activity(
                    attachment=attachment,
                    performed_by=requester_user_id,
                    enabled=enabled,
                    unsupported=unsupported,
                )
                await self._session.commit()
                await self._session.refresh(attachment)
        else:
            await self._chunks.delete_by_attachment(attachment.id)
            attachment.include_in_ai_assistant = False
            await self._record_ai_toggle_activity(
                attachment=attachment,
                performed_by=requester_user_id,
                enabled=enabled,
                unsupported=False,
            )
            await self._session.commit()
            await self._session.refresh(attachment)

        return attachment, unsupported

    async def bulk_set_ai_assistant_enabled(
        self,
        *,
        document_ids: list[UUID],
        enabled: bool,
        requester_user_id: UUID,
        background_tasks: BackgroundTasks,
    ) -> list[AiAssistantBulkItemResult]:
        """Apply ``set_ai_assistant_enabled`` to many documents.

        Pre-fetches all attachments in a single query to avoid N+1.
        Errors per id are returned in the result list rather than raising.
        """
        await self._get_requesting_user(requester_user_id)

        attachments = await self._attachments.get_by_ids(document_ids)
        attachment_map = {a.id: a for a in attachments}

        results: list[AiAssistantBulkItemResult] = []
        for doc_id in document_ids:
            attachment = attachment_map.get(doc_id)
            if attachment is None:
                results.append(
                    AiAssistantBulkItemResult(id=doc_id, ok=False, error="not_found")
                )
                continue
            try:
                attachment, unsupported = await self._toggle_ai_for_attachment(
                    attachment=attachment,
                    enabled=enabled,
                    requester_user_id=requester_user_id,
                    background_tasks=background_tasks,
                )
                results.append(
                    AiAssistantBulkItemResult(
                        id=doc_id,
                        ok=True,
                        include_in_ai_assistant=attachment.include_in_ai_assistant,
                        ocr_status=attachment.ocr_status,
                        unsupported_format=unsupported,
                    )
                )
            except DocumentValidationError as exc:
                results.append(AiAssistantBulkItemResult(id=doc_id, ok=False, error=str(exc)))
            except DocumentStorageError as exc:
                results.append(AiAssistantBulkItemResult(id=doc_id, ok=False, error=str(exc)))
        return results

    async def reindex_document(
        self,
        *,
        document_id: UUID,
        requester_user_id: UUID,
        background_tasks: BackgroundTasks,
    ) -> tuple[Attachment, bool]:
        """Force re-processing of a document (for retry-after-failure flows).

        Idempotent regardless of current ``ocr_status``. If the MIME type is
        not processable, marks the document as SKIPPED and returns
        ``unsupported=True``.
        """
        attachment = await self._attachments.get(document_id)
        if attachment is None:
            raise DocumentNotFoundError("Document not found.")
        await self._get_requesting_user(requester_user_id)

        # Reindexing implies the user wants the document in AI — flip the
        # intent flag if it was off.
        attachment.include_in_ai_assistant = True

        if not is_processable_mime(attachment.mime_type):
            attachment.ocr_status = OcrStatus.SKIPPED
            await self._session.commit()
            await self._session.refresh(attachment)
            return attachment, True

        # Drop any prior chunks so the reindex starts clean.
        await self._chunks.delete_by_attachment(attachment.id)
        attachment.ocr_status = OcrStatus.PENDING
        await self._session.commit()
        await self._session.refresh(attachment)

        background_tasks.add_task(
            DocumentProcessingService().process,
            attachment.id,
            attachment.customer_id,
        )
        return attachment, False

    async def _record_ai_toggle_activity(
        self,
        *,
        attachment: Attachment,
        performed_by: UUID,
        enabled: bool,
        unsupported: bool,
    ) -> None:
        if enabled:
            description = (
                f"Włączono dokument {attachment.original_filename} dla asystenta AI."
            )
            if unsupported:
                description += " Format nie jest wspierany — chunki nie zostaną utworzone."
        else:
            description = (
                f"Wyłączono dokument {attachment.original_filename} z asystenta AI. "
                "Chunki zostały usunięte."
            )

        await self._activity.create(
            {
                "customer_id": attachment.customer_id,
                "contract_id": attachment.contract_id,
                "activity_type": ActivityType.DOCUMENT,
                "description": description,
                "additional_data": {
                    "attachment_id": str(attachment.id),
                    "include_in_ai_assistant": enabled,
                    "unsupported_format": unsupported,
                },
            },
            performed_by=performed_by,
        )

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
