"""CustomerRate and Valorization models."""

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


class CustomerRate(Base):
    """Per-month pricing for a ContractService in a given year."""

    __tablename__ = "customer_rates"
    __table_args__ = (
        UniqueConstraint(
            "contract_service_id", "year", name="uq_rate_cs_year"
        ),
        Index("idx_rates_cs_year", "contract_service_id", "year"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    contract_service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contract_services.id", ondelete="RESTRICT"),
        nullable=False,
    )
    valorization_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("valorizations.id", ondelete="SET NULL"),
        nullable=True,
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)

    # Monthly net prices (1–12)
    net_price_01: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    net_price_02: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    net_price_03: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    net_price_04: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    net_price_05: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    net_price_06: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    net_price_07: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    net_price_08: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    net_price_09: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    net_price_10: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    net_price_11: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    net_price_12: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)

    base_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    discount_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), server_default=text("0.00"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    contract_service: Mapped["ContractService"] = relationship(  # noqa: F821
        "ContractService", back_populates="customer_rates"
    )
    valorization: Mapped[Optional["Valorization"]] = relationship(
        "Valorization", back_populates="customer_rates"
    )


class Valorization(Base):
    """Annual price indexation (valorization) applied to a Contract."""

    __tablename__ = "valorizations"
    __table_args__ = (
        CheckConstraint(
            "index_type IN ('GUS_CPI', 'fixed_pct', 'custom')",
            name="index_type_check",
        ),
        CheckConstraint(
            "status IN ('pending', 'approved', 'applied', 'rejected')",
            name="status_check",
        ),
        UniqueConstraint("contract_id", "year", name="uq_valorization_contract_year"),
        Index("idx_val_contract_year", "contract_id", "year"),
        Index("idx_val_status_planned", "status", "planned_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="RESTRICT"),
        nullable=False,
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    index_type: Mapped[str] = mapped_column(String(20), nullable=False)
    index_value: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    planned_date: Mapped[date] = mapped_column(Date, nullable=False)
    applied_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), server_default=text("'pending'"), nullable=False
    )
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    additional_data: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=text("now()"),
        onupdate=datetime.utcnow,
        nullable=False,
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    contract: Mapped["Contract"] = relationship(  # noqa: F821
        "Contract", back_populates="valorizations"
    )
    customer_rates: Mapped[list["CustomerRate"]] = relationship(
        "CustomerRate", back_populates="valorization"
    )
