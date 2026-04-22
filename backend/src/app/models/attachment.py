"""Attachment model."""

import uuid
from typing import Optional

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


class Attachment(Base, CreatedAtMixin, SoftDeleteMixin):
    """File stored in S3 linked to Customer / Contract / Amendment."""

    __tablename__ = "attachments"
    __table_args__ = (
        Index("idx_att_customer", "customer_id"),
        Index("idx_att_contract", "contract_id"),
        Index(
            "idx_att_ocr_status",
            "ocr_status",
            postgresql_where=text("ocr_status IN ('pending', 'processing')"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
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
        server_default=text("'pending'"),
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
    customer: Mapped[Optional["Customer"]] = relationship(  # noqa: F821
        "Customer", back_populates="attachments"
    )
    contract: Mapped[Optional["Contract"]] = relationship(  # noqa: F821
        "Contract", back_populates="attachments"
    )
    chunks: Mapped[list["DocumentChunk"]] = relationship(  # noqa: F821
        "DocumentChunk", back_populates="attachment", cascade="all, delete-orphan"
    )
