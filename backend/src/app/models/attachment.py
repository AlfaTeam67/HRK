"""Attachment model."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import (
    BigInteger,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, SoftDeleteMixin
from app.models.enums import DocumentType, OcrStatus

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.contract import Contract
    from app.models.customer import Customer
    from app.models.document_chunk import DocumentChunk


class Attachment(Base, CreatedAtMixin, SoftDeleteMixin):
    """File stored in S3 linked to Customer / Contract / Amendment."""

    __tablename__ = "attachments"
    __table_args__ = (
        Index("idx_att_company", "company_id"),
        Index("idx_att_customer", "customer_id"),
        Index("idx_att_contract", "contract_id"),
        Index(
            "idx_att_ocr_status",
            "ocr_status",
            postgresql_where=text("ocr_status IN ('PENDING', 'PROCESSING')"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=True,
    )
    contract_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="CASCADE"),
        nullable=True,
    )
    amendment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contract_amendments.id", ondelete="SET NULL"),
        nullable=True,
    )
    document_type: Mapped[DocumentType] = mapped_column(
        sa.Enum(
            DocumentType,
            name="documenttype",
            create_constraint=False,
            native_enum=False,
        ),
        nullable=False,
    )
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    s3_bucket: Mapped[str] = mapped_column(String(255), nullable=False)
    s3_key: Mapped[str] = mapped_column(String(1000), unique=True, nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    ocr_status: Mapped[OcrStatus | None] = mapped_column(
        sa.Enum(
            OcrStatus,
            name="ocrstatus",
            create_constraint=False,
            native_enum=False,
        ),
        server_default=text("'PENDING'"),
        nullable=True,
    )
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_fields: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, server_default=text("1"), nullable=False)
    # 🔴 Fix: was nullable=False with ondelete="SET NULL" — impossible.
    #    Uploader may be deleted → keep SET NULL, make nullable.
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    company: Mapped[Company | None] = relationship("Company", back_populates="attachments")
    customer: Mapped[Customer | None] = relationship("Customer", back_populates="attachments")
    contract: Mapped[Contract | None] = relationship("Contract", back_populates="attachments")
    chunks: Mapped[list[DocumentChunk]] = relationship(
        "DocumentChunk", back_populates="attachment", cascade="all, delete-orphan"
    )
