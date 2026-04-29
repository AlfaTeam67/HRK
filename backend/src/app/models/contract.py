"""Contract and ContractAmendment models."""

from __future__ import annotations

import uuid
from datetime import date
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import (
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

from app.models.base import (
    AuditMixin,
    Base,
    CreatedAtMixin,
    SoftDeleteMixin,
    TimestampMixin,
)
from app.models.enums import BillingCycle, ContractStatus, ContractType

if TYPE_CHECKING:
    from app.models.activity import ActivityLog
    from app.models.alert import Alert
    from app.models.attachment import Attachment
    from app.models.contract_service import ContractService
    from app.models.customer import Customer
    from app.models.note import Note
    from app.models.rate import Valorization
    from app.models.user import User


class Contract(Base, TimestampMixin, SoftDeleteMixin, AuditMixin):
    """Contract linked to a Customer."""

    __tablename__ = "contracts"
    __table_args__ = (
        Index("idx_contracts_number", "contract_number", unique=True),
        Index("idx_contracts_customer_status", "customer_id", "status"),
        Index("idx_contracts_end_date", "end_date"),
        Index("idx_contracts_deleted_at", "deleted_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    account_manager_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    contract_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    contract_type: Mapped[ContractType] = mapped_column(
        sa.Enum(
            ContractType,
            name="contracttype",
            create_constraint=False,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    status: Mapped[ContractStatus] = mapped_column(
        sa.Enum(
            ContractStatus,
            name="contractstatus",
            create_constraint=False,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        server_default=text("'draft'"),
        nullable=False,
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notice_period_days: Mapped[int | None] = mapped_column(
        Integer, server_default=text("90"), nullable=True
    )
    notice_conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    billing_cycle: Mapped[BillingCycle | None] = mapped_column(
        sa.Enum(
            BillingCycle,
            name="billingcycle",
            create_constraint=False,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        server_default=text("'monthly'"),
        nullable=True,
    )
    governing_law: Mapped[str | None] = mapped_column(
        String(10), server_default=text("'PL'"), nullable=True
    )
    parent_contract_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    additional_data: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )

    # Relationships
    customer: Mapped[Customer] = relationship("Customer", back_populates="contracts")
    account_manager: Mapped[User | None] = relationship("User", foreign_keys=[account_manager_id])
    parent_contract: Mapped[Contract | None] = relationship(
        "Contract",
        remote_side="Contract.id",
        foreign_keys=[parent_contract_id],
        back_populates="child_contracts",
    )
    child_contracts: Mapped[list[Contract]] = relationship(
        "Contract",
        back_populates="parent_contract",
        foreign_keys=[parent_contract_id],
    )
    amendments: Mapped[list[ContractAmendment]] = relationship(
        "ContractAmendment", back_populates="contract"
    )
    contract_services: Mapped[list[ContractService]] = relationship(
        "ContractService", back_populates="contract"
    )
    valorizations: Mapped[list[Valorization]] = relationship(
        "Valorization", back_populates="contract"
    )
    notes_rel: Mapped[list[Note]] = relationship("Note", back_populates="contract")
    attachments: Mapped[list[Attachment]] = relationship("Attachment", back_populates="contract")
    activity_logs: Mapped[list[ActivityLog]] = relationship(
        "ActivityLog", back_populates="contract"
    )
    alerts: Mapped[list[Alert]] = relationship("Alert", back_populates="contract")


class ContractAmendment(Base, CreatedAtMixin):
    """Amendment (aneks) to an existing Contract."""

    __tablename__ = "contract_amendments"
    __table_args__ = (
        UniqueConstraint("contract_id", "amendment_number", name="uq_amendment_contract_number"),
        Index("idx_amendments_contract", "contract_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="RESTRICT"),
        nullable=False,
    )
    amendment_number: Mapped[str] = mapped_column(String(50), nullable=False)
    amendment_date: Mapped[date] = mapped_column(Date, nullable=False)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    scope_of_change: Mapped[str] = mapped_column(Text, nullable=False)
    approved_by_client: Mapped[str | None] = mapped_column(String(255), nullable=True)
    approved_by_hrk: Mapped[str | None] = mapped_column(String(255), nullable=True)
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("attachments.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    contract: Mapped[Contract] = relationship("Contract", back_populates="amendments")
    document: Mapped[Attachment | None] = relationship("Attachment", foreign_keys=[document_id])
