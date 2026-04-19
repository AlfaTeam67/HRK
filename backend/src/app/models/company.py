"""Company model."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import TIMESTAMP, Boolean, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Company(Base, TimestampMixin):
    """Legal entity that a Customer may be linked to."""

    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    nip: Mapped[Optional[str]] = mapped_column(String(15), unique=True, nullable=True)
    regon: Mapped[Optional[str]] = mapped_column(String(14), nullable=True)
    krs: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Address
    address_street: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address_city: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address_postal: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    address_country: Mapped[Optional[str]] = mapped_column(
        String(2), server_default=text("'PL'"), nullable=True
    )

    # Contact
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), nullable=False)

    additional_data: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )

    # Soft delete
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )

    # Relationships
    customers: Mapped[list["Customer"]] = relationship(  # noqa: F821
        "Customer", back_populates="company"
    )
