"""DocumentGeneration model — AI-assisted contract/amendment generation."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import (
    ForeignKey,
    Index,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import DocumentGenerationStatus

if TYPE_CHECKING:
    from app.models.attachment import Attachment
    from app.models.contract import Contract, ContractAmendment
    from app.models.customer import Customer
    from app.models.user import User


class DocumentGeneration(Base, TimestampMixin):
    """One generation run — params + simulation snapshot + produced artifacts.

    Reproducible by design: ``payload`` and ``simulation`` carry everything
    needed to re-render the PDF byte-for-byte at a later point.
    """

    __tablename__ = "document_generations"
    __table_args__ = (
        Index("idx_doc_gen_customer", "customer_id"),
        Index("idx_doc_gen_contract", "contract_id"),
        Index("idx_doc_gen_status_created", "status", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
    )
    contract_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="SET NULL"),
        nullable=True,
    )
    amendment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contract_amendments.id", ondelete="SET NULL"),
        nullable=True,
    )
    attachment_pdf_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("attachments.id", ondelete="SET NULL"),
        nullable=True,
    )
    cover_letter_attachment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("attachments.id", ondelete="SET NULL"),
        nullable=True,
    )

    template_key: Mapped[str] = mapped_column(String(100), nullable=False)
    template_version: Mapped[str] = mapped_column(String(20), nullable=False)

    status: Mapped[DocumentGenerationStatus] = mapped_column(
        sa.Enum(
            DocumentGenerationStatus,
            name="documentgenerationstatus",
            create_constraint=False,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        server_default=text("'draft'"),
        nullable=False,
    )

    # Full input snapshot — params, customer/contract data captured at generation time.
    # Re-rendering uses this exclusively, never live DB state.
    payload: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )

    # Computed financial simulation (delta margin, per-service breakdown, totals).
    simulation: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )

    # AI-generated narrative parts: { rationale, cover_letter, model, prompt_hash, tone }.
    # Liczby i klauzule prawne nigdy nie pochodzą stąd.
    ai_artifacts: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )

    # SHA-256 of the final PDF bytes — proof of integrity for accepted versions.
    pdf_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)

    generated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    accepted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    customer: Mapped[Customer] = relationship("Customer")
    contract: Mapped[Contract | None] = relationship("Contract")
    amendment: Mapped[ContractAmendment | None] = relationship("ContractAmendment")
    pdf_attachment: Mapped[Attachment | None] = relationship(
        "Attachment", foreign_keys=[attachment_pdf_id]
    )
    cover_letter_attachment: Mapped[Attachment | None] = relationship(
        "Attachment", foreign_keys=[cover_letter_attachment_id]
    )
    generated_by_user: Mapped[User | None] = relationship("User", foreign_keys=[generated_by])
    accepted_by_user: Mapped[User | None] = relationship("User", foreign_keys=[accepted_by])
