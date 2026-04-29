"""Alert model."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin
from app.models.enums import AlertStatus, AlertType

if TYPE_CHECKING:
    from app.models.contract import Contract
    from app.models.customer import Customer


class Alert(Base, CreatedAtMixin):
    """Actionable alert for an Account Manager."""

    __tablename__ = "alerts"
    __table_args__ = (
        CheckConstraint(
            "customer_id IS NOT NULL OR contract_id IS NOT NULL",
            name="ck_alerts_alert_parent_check",
        ),
        Index("idx_alert_trigger_status", "trigger_date", "status"),
        Index("idx_alert_assigned", "assigned_to", "status"),
        Index("idx_alert_customer", "customer_id"),
        Index("idx_alert_contract", "contract_id"),
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
    alert_type: Mapped[AlertType] = mapped_column(
        sa.Enum(
            AlertType,
            name="alerttype",
            create_constraint=False,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    status: Mapped[AlertStatus] = mapped_column(
        sa.Enum(
            AlertStatus,
            name="alertstatus",
            create_constraint=False,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        server_default=text("'open'"),
        nullable=False,
    )
    trigger_date: Mapped[date] = mapped_column(Date, nullable=False)
    days_before: Mapped[int | None] = mapped_column(Integer, nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )

    # Relationships
    customer: Mapped[Customer | None] = relationship("Customer", back_populates="alerts")
    contract: Mapped[Contract | None] = relationship("Contract", back_populates="alerts")
