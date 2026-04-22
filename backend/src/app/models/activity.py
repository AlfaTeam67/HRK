"""ActivityLog model."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import (
    ForeignKey,
    Index,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin
from app.models.enums import ActivityType

if TYPE_CHECKING:
    from app.models.contract import Contract
    from app.models.customer import Customer


class ActivityLog(Base, CreatedAtMixin):
    """Immutable log of CRM activities (meetings, emails, calls, etc.)."""

    __tablename__ = "activity_logs"
    __table_args__ = (
        Index("idx_act_customer_date", "customer_id", "activity_date"),
        Index("idx_act_contract", "contract_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=True,
    )
    contract_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="SET NULL"),
        nullable=True,
    )
    activity_type: Mapped[ActivityType] = mapped_column(
        sa.Enum(
            ActivityType,
            name="activitytype",
            create_constraint=False,
            native_enum=False,
        ),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    performed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    activity_date: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False
    )

    additional_data: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )

    # IMMUTABLE — only created_at (via CreatedAtMixin), no updated_at or deleted_at

    # Relationships
    customer: Mapped[Customer | None] = relationship(
        "Customer", back_populates="activity_logs"
    )
    contract: Mapped[Contract | None] = relationship(
        "Contract", back_populates="activity_logs"
    )
