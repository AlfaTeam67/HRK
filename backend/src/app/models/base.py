"""SQLAlchemy declarative Base and shared mixins."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import TIMESTAMP, ForeignKey, MetaData, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Naming convention for constraints — makes Alembic autogenerate deterministic names.
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Application-wide declarative base with naming convention."""

    metadata = MetaData(naming_convention=convention)


# ── Mixins ───────────────────────────────────────────────────────────────────


class CreatedAtMixin:
    """Mixin that adds a ``created_at`` column (immutable entities)."""

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )


class TimestampMixin(CreatedAtMixin):
    """Mixin that adds ``created_at`` + ``updated_at`` columns."""

    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=text("now()"),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )


class SoftDeleteMixin:
    """Mixin that adds a ``deleted_at`` column for soft-delete."""

    deleted_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)


class AuditMixin:
    """Mixin that adds ``created_by`` / ``updated_by`` FK columns."""

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
