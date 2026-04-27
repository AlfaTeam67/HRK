from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import DocumentType, OcrStatus


class DocumentRead(BaseModel):
    id: UUID
    company_id: UUID | None = None
    customer_id: UUID | None = None
    contract_id: UUID | None = None
    amendment_id: UUID | None = None
    document_type: DocumentType
    original_filename: str
    s3_bucket: str
    s3_key: str
    mime_type: str | None = None
    file_size_bytes: int | None = None
    ocr_status: OcrStatus | None = None
    uploaded_by: UUID | None = None
    created_at: datetime
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class DocumentDownloadURLRead(BaseModel):
    url: str
    expires_in: int
