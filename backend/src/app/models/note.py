"""Note model."""

import uuid
from typing import Optional

import sqlalchemy as sa
from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin
from app.models.enums import NoteType


class Note(Base, TimestampMixin, SoftDeleteMixin):
    """Free-text note linked to a Customer and/or Contract."""

    __tablename__ = "notes"
    __table_args__ = (
        CheckConstraint(
            "customer_id IS NOT NULL OR contract_id IS NOT NULL",
            name="ck_notes_note_parent_check",
        ),
        Index("idx_notes_customer", "customer_id"),
        Index("idx_notes_contract", "contract_id"),
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
    note_type: Mapped[NoteType] = mapped_column(
        sa.Enum(
            NoteType,
            name="notetype",
            create_constraint=False,
            native_enum=False,
        ),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # 🔴 Fix: was nullable=False with ondelete="SET NULL" — impossible.
    #    Author may be deleted → keep SET NULL, make nullable.
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    customer: Mapped[Optional["Customer"]] = relationship(  # noqa: F821
        "Customer", back_populates="notes"
    )
    contract: Mapped[Optional["Contract"]] = relationship(  # noqa: F821
        "Contract", back_populates="notes_rel"
    )
