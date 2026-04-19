"""Customer and ContactPerson models."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Customer(Base, TimestampMixin):
    """Customer account in the CRM."""

    __tablename__ = "customers"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'churn_risk', 'needs_attention', 'inactive')",
            name="status_check",
        ),
        Index("idx_customers_ckk", "ckk", unique=True),
        Index("idx_customers_ckd", "ckd", unique=True),
        Index("idx_customers_account_manager", "account_manager_id"),
        Index("idx_customers_status", "status"),
        Index("idx_customers_deleted_at", "deleted_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    ckk: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    ckd: Mapped[Optional[str]] = mapped_column(String(10), unique=True, nullable=True)

    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="RESTRICT"),
        nullable=True,
    )
    account_manager_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(30), server_default=text("'active'"), nullable=False
    )
    segment: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    industry: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    employee_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Billing
    payment_period_days: Mapped[Optional[int]] = mapped_column(
        Integer, server_default=text("21"), nullable=True
    )
    account_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    billing_nip: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)
    billing_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    invoice_nip: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)

    # Contact
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Address
    address_street: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address_city: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address_postal: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    address_country: Mapped[Optional[str]] = mapped_column(
        String(2), server_default=text("'PL'"), nullable=True
    )

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
    company: Mapped[Optional["Company"]] = relationship(  # noqa: F821
        "Company", back_populates="customers"
    )
    account_manager: Mapped["User"] = relationship(  # noqa: F821
        "User",
        back_populates="managed_customers",
        foreign_keys=[account_manager_id],
    )
    contact_persons: Mapped[list["ContactPerson"]] = relationship(
        "ContactPerson", back_populates="customer", cascade="all, delete-orphan"
    )
    contracts: Mapped[list["Contract"]] = relationship(  # noqa: F821
        "Contract", back_populates="customer"
    )
    notes: Mapped[list["Note"]] = relationship(  # noqa: F821
        "Note", back_populates="customer"
    )
    attachments: Mapped[list["Attachment"]] = relationship(  # noqa: F821
        "Attachment", back_populates="customer"
    )
    activity_logs: Mapped[list["ActivityLog"]] = relationship(  # noqa: F821
        "ActivityLog", back_populates="customer"
    )
    relation_scores: Mapped[list["CustomerRelationScore"]] = relationship(  # noqa: F821
        "CustomerRelationScore", back_populates="customer"
    )
    alerts: Mapped[list["Alert"]] = relationship(  # noqa: F821
        "Alert", back_populates="customer"
    )


class ContactPerson(Base):
    """Contact person linked to a Customer."""

    __tablename__ = "contact_persons"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    role: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_primary: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )
    is_contract_signer: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )

    additional_data: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )

    # Relationships
    customer: Mapped["Customer"] = relationship(
        "Customer", back_populates="contact_persons"
    )
