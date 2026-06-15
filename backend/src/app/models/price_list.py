"""PriceListTemplate model — universal base price list.

Each row defines the standard (list) price for a Service.
These are used as a starting point when creating CustomerRate entries.
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import (
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.service import Service


class PriceListTemplate(Base, TimestampMixin):
    """Standard list price for a Service.

    One active record per service — enforced by unique constraint on
    (service_id) filtered to non-deleted rows.
    Soft delete is intentionally omitted: deactivate via ``is_active`` flag.
    """

    __tablename__ = "price_list_templates"
    __table_args__ = (
        UniqueConstraint("service_id", name="uq_price_list_service"),
        Index("idx_price_list_service", "service_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("services.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # List price — the standard rate before any customer discount
    list_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Optional note describing what the price covers (e.g. "per head, min 50 employees")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Label for grouping/filtering (e.g. "2026", "Standard", "Promocja Q1")
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)

    is_active: Mapped[bool] = mapped_column(
        sa.Boolean, server_default=text("true"), nullable=False
    )

    # Relationships
    service: Mapped[Service] = relationship("Service", backref="price_list_template")
