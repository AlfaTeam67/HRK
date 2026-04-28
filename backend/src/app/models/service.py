"""Service model."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import (
    Boolean,
    ForeignKey,
    Index,
    Numeric,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, SoftDeleteMixin
from app.models.enums import BillingFrequency, BillingUnit

if TYPE_CHECKING:
    from app.models.contract_service import ContractService
    from app.models.service_group import ServiceGroup


class Service(Base, CreatedAtMixin, SoftDeleteMixin):
    """Individual billable service."""

    __tablename__ = "services"
    __table_args__ = (Index("idx_services_group", "group_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("service_groups.id", ondelete="RESTRICT"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    billing_unit: Mapped[BillingUnit] = mapped_column(
        sa.Enum(
            BillingUnit,
            name="billingunit",
            create_constraint=False,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    billing_frequency: Mapped[BillingFrequency] = mapped_column(
        sa.Enum(
            BillingFrequency,
            name="billingfrequency",
            create_constraint=False,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        server_default=text("'monthly'"),
        nullable=False,
    )
    vat_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(4, 2),
        server_default=text("23.00"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), nullable=False)

    additional_data: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )

    # Relationships
    group: Mapped[ServiceGroup] = relationship("ServiceGroup", back_populates="services")
    contract_services: Mapped[list[ContractService]] = relationship(
        "ContractService", back_populates="service"
    )
