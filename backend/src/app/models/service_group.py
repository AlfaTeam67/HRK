"""ServiceGroup model — hierarchical grouping of services."""

import uuid
from typing import Optional

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Integer,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin


class ServiceGroup(Base, CreatedAtMixin):
    """Hierarchical grouping of services (materialized path).

    ``path_id`` and ``path_name`` store the materialized path from root to
    this node.  They are **denormalised** — the service layer (or a future
    PostgreSQL trigger) is responsible for keeping them in sync whenever a
    node is renamed or moved.

    .. todo:: ALF-XX — add DB trigger or service-layer hook to refresh
       ``path_id`` / ``path_name`` on parent rename / move.
    """

    __tablename__ = "service_groups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("service_groups.id", ondelete="RESTRICT"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    service_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    level: Mapped[int] = mapped_column(Integer, server_default=text("1"), nullable=False)
    path_id: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True)
    path_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), nullable=False)

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
    services: Mapped[list["Service"]] = relationship(  # noqa: F821
        "Service", back_populates="group"
    )
