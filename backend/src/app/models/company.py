"""Company model."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.attachment import Attachment
    from app.models.customer import Customer


class Company(Base, TimestampMixin, SoftDeleteMixin):
    """Legal entity that a Customer may be linked to."""

    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    nip: Mapped[str | None] = mapped_column(String(15), unique=True, nullable=True)
    regon: Mapped[str | None] = mapped_column(String(14), nullable=True)
    krs: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Address
    address_street: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_postal: Mapped[str | None] = mapped_column(String(10), nullable=True)
    address_country: Mapped[str | None] = mapped_column(
        String(2), server_default=text("'PL'"), nullable=True
    )

    # Contact
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), nullable=False)

    additional_data: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )

    # Relationships
    customers: Mapped[list[Customer]] = relationship("Customer", back_populates="company")
    attachments: Mapped[list[Attachment]] = relationship("Attachment", back_populates="company")
