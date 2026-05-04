"""GUS CPI snapshot model."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Index, Integer, Numeric, String, TIMESTAMP, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreatedAtMixin


class GusCpiSnapshot(Base, CreatedAtMixin):
    """Persisted CPI values fetched from GUS BDL."""

    __tablename__ = "gus_cpi_snapshots"
    __table_args__ = (
        UniqueConstraint("year", "quarter", name="uq_gus_cpi_year_quarter"),
        Index("idx_gus_cpi_period", "year", "quarter"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    quarter: Mapped[int] = mapped_column(Integer, nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    source: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default=text("'GUS BDL'")
    )
    fetched_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False
    )
