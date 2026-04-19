"""Contract and ContractAmendment models."""

import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    TIMESTAMP,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Contract(Base, TimestampMixin):
    """Contract linked to a Customer."""

    __tablename__ = "contracts"
    __table_args__ = (
        CheckConstraint(
            "contract_type IN ('ramowa', 'aneks', 'SLA', 'DPA', 'PPK', 'inne')",
            name="contract_type_check",
        ),
        CheckConstraint(
            "status IN ('draft', 'signed', 'active', 'expiring', 'terminated')",
            name="status_check",
        ),
        CheckConstraint(
            "billing_cycle IN ('monthly', 'quarterly', 'annual', 'one_time')",
            name="billing_cycle_check",
        ),
        Index("idx_contracts_number", "contract_number", unique=True),
        Index("idx_contracts_customer_status", "customer_id", "status"),
        Index("idx_contracts_end_date", "end_date"),
        Index("idx_contracts_deleted_at", "deleted_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    account_manager_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    contract_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    contract_type: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), server_default=text("'draft'"), nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notice_period_days: Mapped[Optional[int]] = mapped_column(
        Integer, server_default=text("90"), nullable=True
    )
    notice_conditions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    billing_cycle: Mapped[Optional[str]] = mapped_column(
        String(20), server_default=text("'monthly'"), nullable=True
    )
    governing_law: Mapped[Optional[str]] = mapped_column(
        String(10), server_default=text("'PL'"), nullable=True
    )
    parent_contract_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    additional_data: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )

    # Audit fields
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Soft delete
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )

    # Relationships
    customer: Mapped["Customer"] = relationship(  # noqa: F821
        "Customer", back_populates="contracts"
    )
    account_manager: Mapped[Optional["User"]] = relationship(  # noqa: F821
        "User", foreign_keys=[account_manager_id]
    )
    parent_contract: Mapped[Optional["Contract"]] = relationship(
        "Contract",
        remote_side="Contract.id",
        foreign_keys=[parent_contract_id],
        back_populates="child_contracts",
    )
    child_contracts: Mapped[list["Contract"]] = relationship(
        "Contract",
        back_populates="parent_contract",
        foreign_keys=[parent_contract_id],
    )
    amendments: Mapped[list["ContractAmendment"]] = relationship(
        "ContractAmendment", back_populates="contract"
    )
    contract_services: Mapped[list["ContractService"]] = relationship(  # noqa: F821
        "ContractService", back_populates="contract"
    )
    valorizations: Mapped[list["Valorization"]] = relationship(  # noqa: F821
        "Valorization", back_populates="contract"
    )
    notes_rel: Mapped[list["Note"]] = relationship(  # noqa: F821
        "Note", back_populates="contract"
    )
    attachments: Mapped[list["Attachment"]] = relationship(  # noqa: F821
        "Attachment", back_populates="contract"
    )
    activity_logs: Mapped[list["ActivityLog"]] = relationship(  # noqa: F821
        "ActivityLog", back_populates="contract"
    )
    alerts: Mapped[list["Alert"]] = relationship(  # noqa: F821
        "Alert", back_populates="contract"
    )


class ContractAmendment(Base):
    """Amendment (aneks) to an existing Contract."""

    __tablename__ = "contract_amendments"
    __table_args__ = (
        UniqueConstraint("contract_id", "amendment_number", name="uq_amendment_contract_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="RESTRICT"),
        nullable=False,
    )
    amendment_number: Mapped[str] = mapped_column(String(50), nullable=False)
    amendment_date: Mapped[date] = mapped_column(Date, nullable=False)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    scope_of_change: Mapped[str] = mapped_column(Text, nullable=False)
    approved_by_client: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    approved_by_hrk: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("attachments.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    contract: Mapped["Contract"] = relationship(
        "Contract", back_populates="amendments"
    )
    document: Mapped[Optional["Attachment"]] = relationship(  # noqa: F821
        "Attachment"
    )
