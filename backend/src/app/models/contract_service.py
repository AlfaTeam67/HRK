"""ContractService model — junction between Contract and Service."""

from __future__ import annotations

import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.contract import Contract
    from app.models.rate import CustomerRate
    from app.models.service import Service


class ContractService(Base):
    """Junction between Contract and Service with scope/SLA details."""

    __tablename__ = "contract_services"
    __table_args__ = (
        UniqueConstraint(
            "contract_id",
            "service_id",
            "valid_from",
            name="uq_contract_service_valid_from",
        ),
        Index("idx_cs_contract", "contract_id"),
        Index("idx_cs_service", "service_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
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
    scope_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    volume_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    volume_unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    sla_definition: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_billable: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), nullable=False)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)

    additional_data: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )

    # Relationships
    contract: Mapped[Contract] = relationship("Contract", back_populates="contract_services")
    service: Mapped[Service] = relationship("Service", back_populates="contract_services")
    customer_rates: Mapped[list[CustomerRate]] = relationship(
        "CustomerRate", back_populates="contract_service"
    )
