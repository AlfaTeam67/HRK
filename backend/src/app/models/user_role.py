"""User role assignments (supports multiple roles per user)."""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import UserRole


class UserRoleAssignment(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role: Mapped[UserRole] = mapped_column(
        sa.Enum(UserRole, name="userrole", create_constraint=False, native_enum=False),
        primary_key=True,
    )
