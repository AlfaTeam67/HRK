"""ContractService model — junction between Contract and Service."""

import uuid
from datetime import date

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
    contract: Mapped["Contract"] = relationship(  # noqa: F821
        "Contract", back_populates="contract_services"
    )
    service: Mapped["Service"] = relationship(  # noqa: F821
        "Service", back_populates="contract_services"
    )
    customer_rates: Mapped[list["CustomerRate"]] = relationship(  # noqa: F821
        "CustomerRate", back_populates="contract_service"
    )
