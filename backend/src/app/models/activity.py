"""ActivityLog, CustomerRelationScore, and Alert models."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    TIMESTAMP,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ActivityLog(Base):
    """Immutable log of CRM activities (meetings, emails, calls, etc.)."""

    __tablename__ = "activity_logs"
    __table_args__ = (
        CheckConstraint(
            "activity_type IN ('meeting', 'email', 'note', 'document', "
            "'verification', 'call', 'system')",
            name="activity_type_check",
        ),
        Index("idx_act_customer_date", "customer_id", "activity_date"),
        Index("idx_act_contract", "contract_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=True,
    )
    contract_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="SET NULL"),
        nullable=True,
    )
    activity_type: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    performed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    activity_date: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False
    )

    additional_data: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )

    # IMMUTABLE — only created_at, no updated_at or deleted_at
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False
    )

    # Relationships
    customer: Mapped[Optional["Customer"]] = relationship(  # noqa: F821
        "Customer", back_populates="activity_logs"
    )
    contract: Mapped[Optional["Contract"]] = relationship(  # noqa: F821
        "Contract", back_populates="activity_logs"
    )


class CustomerRelationScore(Base):
    """Periodic customer health score (AI or manual)."""

    __tablename__ = "customer_relation_scores"
    __table_args__ = (
        CheckConstraint(
            "score_label IN ('good', 'needs_attention', 'churn_risk')",
            name="score_label_check",
        ),
        CheckConstraint(
            "score_value BETWEEN 0.00 AND 1.00",
            name="score_value_range",
        ),
        CheckConstraint(
            "calculated_by IN ('ai', 'manual')",
            name="calculated_by_check",
        ),
        UniqueConstraint("customer_id", "score_date", name="uq_score_customer_date"),
        Index("idx_score_customer_date", "customer_id", "score_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
    )
    score_date: Mapped[date] = mapped_column(Date, nullable=False)
    score_label: Mapped[str] = mapped_column(String(20), nullable=False)
    score_value: Mapped[Decimal] = mapped_column(Numeric(3, 2), nullable=False)
    reasoning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    calculated_by: Mapped[str] = mapped_column(
        String(10), server_default=text("'ai'"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False
    )

    # Relationships
    customer: Mapped["Customer"] = relationship(  # noqa: F821
        "Customer", back_populates="relation_scores"
    )


class Alert(Base):
    """Actionable alert for an Account Manager."""

    __tablename__ = "alerts"
    __table_args__ = (
        CheckConstraint(
            "alert_type IN ('contract_expiry', 'valorization_overdue', 'no_contact', "
            "'high_discount', 'contract_notice', 'custom')",
            name="alert_type_check",
        ),
        CheckConstraint(
            "status IN ('open', 'acknowledged', 'resolved', 'snoozed')",
            name="status_check",
        ),
        Index("idx_alert_trigger_status", "trigger_date", "status"),
        Index("idx_alert_assigned", "assigned_to", "status"),
        Index("idx_alert_customer", "customer_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=True,
    )
    contract_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="SET NULL"),
        nullable=True,
    )
    alert_type: Mapped[str] = mapped_column(String(40), nullable=False)
    entity_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), server_default=text("'open'"), nullable=False
    )
    trigger_date: Mapped[date] = mapped_column(Date, nullable=False)
    days_before: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False
    )

    # Relationships
    customer: Mapped[Optional["Customer"]] = relationship(  # noqa: F821
        "Customer", back_populates="alerts"
    )
    contract: Mapped[Optional["Contract"]] = relationship(  # noqa: F821
        "Contract", back_populates="alerts"
    )
