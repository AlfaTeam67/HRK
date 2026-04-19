"""ServiceGroup, Service, and ContractService models."""

import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
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


class ServiceGroup(Base):
    """Hierarchical grouping of services (materialized path)."""

    __tablename__ = "service_groups"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("service_groups.id", ondelete="RESTRICT"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    service_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    level: Mapped[int] = mapped_column(Integer, server_default=text("1"), nullable=False)
    path_id: Mapped[Optional[str]] = mapped_column(String(50), unique=True, nullable=True)
    path_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False
    )

    # Relationships
    parent: Mapped[Optional["ServiceGroup"]] = relationship(
        "ServiceGroup",
        remote_side="ServiceGroup.id",
        foreign_keys=[parent_id],
        back_populates="children",
    )
    children: Mapped[list["ServiceGroup"]] = relationship(
        "ServiceGroup",
        back_populates="parent",
        foreign_keys=[parent_id],
    )
    services: Mapped[list["Service"]] = relationship(
        "Service", back_populates="group"
    )


class Service(Base):
    """Individual billable service."""

    __tablename__ = "services"
    __table_args__ = (
        CheckConstraint(
            "billing_unit IN ('per_person', 'ryczalt', 'per_hour', 'per_doc', 'per_item')",
            name="billing_unit_check",
        ),
        CheckConstraint(
            "billing_frequency IN ('monthly', 'quarterly', 'one_time', 'on_demand')",
            name="billing_frequency_check",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("service_groups.id", ondelete="RESTRICT"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    billing_unit: Mapped[str] = mapped_column(String(30), nullable=False)
    billing_frequency: Mapped[str] = mapped_column(
        String(20), server_default=text("'monthly'"), nullable=False
    )
    vat_rate: Mapped[Optional[float]] = mapped_column(
        Numeric(4, 2),
        server_default=text("23.00"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), nullable=False)

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
    group: Mapped["ServiceGroup"] = relationship(
        "ServiceGroup", back_populates="services"
    )
    contract_services: Mapped[list["ContractService"]] = relationship(
        "ContractService", back_populates="service"
    )


class ContractService(Base):
    """Junction between Contract and Service with scope/SLA details."""

    __tablename__ = "contract_services"
    __table_args__ = (
        UniqueConstraint(
            "contract_id", "service_id", "valid_from",
            name="uq_contract_service_valid_from",
        ),
        Index("idx_cs_contract", "contract_id"),
        Index("idx_cs_service", "service_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="RESTRICT"),
        nullable=False,
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("services.id", ondelete="RESTRICT"),
        nullable=False,
    )
    scope_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    volume_limit: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    volume_unit: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    sla_definition: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_billable: Mapped[bool] = mapped_column(
        Boolean, server_default=text("true"), nullable=False
    )
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    additional_data: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )

    # Relationships
    contract: Mapped["Contract"] = relationship(  # noqa: F821
        "Contract", back_populates="contract_services"
    )
    service: Mapped["Service"] = relationship(
        "Service", back_populates="contract_services"
    )
    customer_rates: Mapped[list["CustomerRate"]] = relationship(  # noqa: F821
        "CustomerRate", back_populates="contract_service"
    )
