"""CustomerRelationScore model."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Numeric,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin
from app.models.enums import CalculatedBy, ScoreLabel

if TYPE_CHECKING:
    from app.models.customer import Customer


class CustomerRelationScore(Base, CreatedAtMixin):
    """Periodic customer health score (AI or manual)."""

    __tablename__ = "customer_relation_scores"
    __table_args__ = (
        CheckConstraint(
            "score_value BETWEEN 0.00 AND 1.00",
            name="ck_customer_relation_scores_score_value_range",
        ),
        UniqueConstraint("customer_id", "score_date", name="uq_score_customer_date"),
        Index("idx_score_customer_date", "customer_id", "score_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
    )
    score_date: Mapped[date] = mapped_column(Date, nullable=False)
    score_label: Mapped[ScoreLabel] = mapped_column(
        sa.Enum(
            ScoreLabel,
            name="scorelabel",
            create_constraint=False,
            native_enum=False,
        ),
        nullable=False,
    )
    score_value: Mapped[Decimal] = mapped_column(Numeric(3, 2), nullable=False)
    reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    calculated_by: Mapped[CalculatedBy] = mapped_column(
        sa.Enum(
            CalculatedBy,
            name="calculatedby",
            create_constraint=False,
            native_enum=False,
        ),
        server_default=text("'ai'"),
        nullable=False,
    )

    # Relationships
    customer: Mapped[Customer] = relationship(
        "Customer", back_populates="relation_scores"
    )
