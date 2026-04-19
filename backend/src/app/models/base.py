"""SQLAlchemy declarative Base and shared mixins."""

import uuid
from datetime import datetime

from sqlalchemy import TIMESTAMP, MetaData, text
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


class TimestampMixin:
    """Mixin that adds created_at / updated_at columns."""

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=text("now()"),
        onupdate=datetime.utcnow,
        nullable=False,
    )
