"""CustomerRate, CustomerRateMonth, and Valorization models."""

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
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, TimestampMixin
from app.models.enums import IndexType, ValorizationStatus

if TYPE_CHECKING:
    from app.models.contract import Contract
    from app.models.contract_service import ContractService


class CustomerRate(Base, CreatedAtMixin):
    """Pricing for a ContractService in a given year."""

    __tablename__ = "customer_rates"
    __table_args__ = (
        UniqueConstraint("contract_service_id", "year", name="uq_rate_cs_year"),
        Index("idx_rates_cs_year", "contract_service_id", "year"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contract_services.id", ondelete="RESTRICT"),
        nullable=False,
    )
    valorization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("valorizations.id", ondelete="SET NULL"),
        nullable=True,
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)

    base_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    discount_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), server_default=text("0.00"), nullable=False
    )

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    contract_service: Mapped[ContractService] = relationship(
        "ContractService", back_populates="customer_rates"
    )
    valorization: Mapped[Valorization | None] = relationship(
        "Valorization", back_populates="customer_rates"
    )
    monthly_prices: Mapped[list[CustomerRateMonth]] = relationship(
        "CustomerRateMonth", back_populates="rate", cascade="all, delete-orphan"
    )


class CustomerRateMonth(Base):
    """Per-month net price for a CustomerRate — normalised from 12 columns (1NF).

    Replaces the previous ``net_price_01`` … ``net_price_12`` anti-pattern,
    allowing queries like ``WHERE month = 3`` without hard-coding column names.
    """

    __tablename__ = "customer_rate_months"
    __table_args__ = (
        UniqueConstraint("rate_id", "month", name="uq_rate_month"),
        CheckConstraint(
            "month BETWEEN 1 AND 12",
            name="ck_customer_rate_months_month_range",
        ),
        Index("idx_rate_months_rate", "rate_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customer_rates.id", ondelete="CASCADE"),
        nullable=False,
    )
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    net_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Relationships
    rate: Mapped[CustomerRate] = relationship("CustomerRate", back_populates="monthly_prices")


class Valorization(Base, TimestampMixin):
    """Annual price indexation (valorization) applied to a Contract."""

    __tablename__ = "valorizations"
    __table_args__ = (
        UniqueConstraint("contract_id", "year", name="uq_valorization_contract_year"),
        Index("idx_val_contract_year", "contract_id", "year"),
        Index("idx_val_status_planned", "status", "planned_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="RESTRICT"),
        nullable=False,
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    index_type: Mapped[IndexType] = mapped_column(
        sa.Enum(
            IndexType,
            name="indextype",
            create_constraint=False,
            native_enum=False,
        ),
        nullable=False,
    )
    index_value: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    planned_date: Mapped[date] = mapped_column(Date, nullable=False)
    applied_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[ValorizationStatus] = mapped_column(
        sa.Enum(
            ValorizationStatus,
            name="valorizationstatus",
            create_constraint=False,
            native_enum=False,
        ),
        server_default=text("'pending'"),
        nullable=False,
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    additional_data: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    contract: Mapped[Contract] = relationship(
        "Contract", back_populates="valorizations"
    )
    customer_rates: Mapped[list[CustomerRate]] = relationship(
        "CustomerRate", back_populates="valorization"
    )
