"""Custom data definition models."""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy import ForeignKey, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin


class CustomFieldDefinition(Base, CreatedAtMixin):
    """Defines a custom field on a customer card."""

    __tablename__ = "custom_field_definitions"
    __table_args__ = (
        sa.UniqueConstraint("customer_id", "field_name", name="uq_custom_field_customer_name"),
        Index("idx_custom_field_defs_customer", "customer_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)
    field_type: Mapped[str] = mapped_column(String(20), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class CustomTableDefinition(Base, CreatedAtMixin):
    """Defines a custom table (mini-spreadsheet) for a customer."""

    __tablename__ = "custom_table_definitions"
    __table_args__ = (
        sa.UniqueConstraint("customer_id", "table_slug", name="uq_custom_table_customer_slug"),
        Index("idx_custom_table_defs_customer", "customer_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )
    table_slug: Mapped[str] = mapped_column(String(100), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    db_table_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    sort_order: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    columns: Mapped[list[CustomColumnDefinition]] = relationship(
        "CustomColumnDefinition", back_populates="table_def", cascade="all, delete-orphan"
    )


class CustomColumnDefinition(Base):
    """Defines a column within a custom table."""

    __tablename__ = "custom_column_definitions"
    __table_args__ = (
        sa.UniqueConstraint("table_def_id", "column_name", name="uq_custom_col_table_name"),
        Index("idx_custom_col_defs_table", "table_def_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    table_def_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("custom_table_definitions.id", ondelete="CASCADE"),
        nullable=False,
    )
    column_name: Mapped[str] = mapped_column(String(100), nullable=False)
    column_type: Mapped[str] = mapped_column(String(20), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    table_def: Mapped[CustomTableDefinition] = relationship(
        "CustomTableDefinition", back_populates="columns"
    )
