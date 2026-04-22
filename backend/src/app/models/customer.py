"""Customer and ContactPerson models."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import (
    Boolean,
    ForeignKey,
    Index,
    Integer,
    String,
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
from app.models.enums import CustomerStatus

if TYPE_CHECKING:
    from app.models.activity import ActivityLog
    from app.models.alert import Alert
    from app.models.attachment import Attachment
    from app.models.company import Company
    from app.models.contract import Contract
    from app.models.note import Note
    from app.models.score import CustomerRelationScore
    from app.models.user import User


class Customer(Base, TimestampMixin, SoftDeleteMixin, AuditMixin):
    """Customer account in the CRM."""

    __tablename__ = "customers"
    __table_args__ = (
        Index("idx_customers_ckk", "ckk", unique=True),
        Index("idx_customers_ckd", "ckd", unique=True),
        Index("idx_customers_account_manager", "account_manager_id"),
        Index("idx_customers_company", "company_id"),
        Index("idx_customers_status", "status"),
        Index("idx_customers_deleted_at", "deleted_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ckk: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    ckd: Mapped[str | None] = mapped_column(String(10), unique=True, nullable=True)

    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="RESTRICT"),
        nullable=True,
    )
    # 🔴 Fix: was ondelete="SET NULL" with nullable=False — impossible.
    #    Customer MUST have an account manager → RESTRICT.
    account_manager_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    status: Mapped[CustomerStatus] = mapped_column(
        sa.Enum(
            CustomerStatus,
            name="customerstatus",
            create_constraint=False,
            native_enum=False,
        ),
        server_default=text("'active'"),
        nullable=False,
    )
    segment: Mapped[str | None] = mapped_column(String(50), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    employee_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Billing
    payment_period_days: Mapped[int | None] = mapped_column(
        Integer, server_default=text("21"), nullable=True
    )
    account_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    billing_nip: Mapped[str | None] = mapped_column(String(15), nullable=True)
    billing_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    invoice_nip: Mapped[str | None] = mapped_column(String(15), nullable=True)

    # Contact
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Address
    address_street: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_postal: Mapped[str | None] = mapped_column(String(10), nullable=True)
    address_country: Mapped[str | None] = mapped_column(
        String(2), server_default=text("'PL'"), nullable=True
    )

    additional_data: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )

    # Relationships
    company: Mapped[Company | None] = relationship(
        "Company", back_populates="customers"
    )
    account_manager: Mapped[User] = relationship(
        "User",
        back_populates="managed_customers",
        foreign_keys=[account_manager_id],
    )
    contact_persons: Mapped[list[ContactPerson]] = relationship(
        "ContactPerson", back_populates="customer", cascade="all, delete-orphan"
    )
    contracts: Mapped[list[Contract]] = relationship(
        "Contract", back_populates="customer"
    )
    notes: Mapped[list[Note]] = relationship(
        "Note", back_populates="customer"
    )
    attachments: Mapped[list[Attachment]] = relationship(
        "Attachment", back_populates="customer"
    )
    activity_logs: Mapped[list[ActivityLog]] = relationship(
        "ActivityLog", back_populates="customer"
    )
    relation_scores: Mapped[list[CustomerRelationScore]] = relationship(
        "CustomerRelationScore", back_populates="customer"
    )
    alerts: Mapped[list[Alert]] = relationship(
        "Alert", back_populates="customer"
    )


class ContactPerson(Base, CreatedAtMixin, SoftDeleteMixin):
    """Contact person linked to a Customer."""

    __tablename__ = "contact_persons"
    __table_args__ = (Index("idx_contact_persons_customer", "customer_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    role: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, server_default=text("false"), nullable=False)
    is_contract_signer: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )

    additional_data: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )

    # Relationships
    customer: Mapped[Customer] = relationship("Customer", back_populates="contact_persons")
