"""Common schema utilities."""

from collections.abc import Sequence
from typing import TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class ORMBaseSchema(BaseModel):
    """Schema base configured for SQLAlchemy model serialization."""

    model_config = ConfigDict(from_attributes=True)


class MessageResponse(BaseModel):
    """Simple message response schema."""

    message: str


class PaginationParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


class PaginatedResponse[T](BaseModel):
    items: Sequence[T]
    total: int
    page: int
    page_size: int
    pages: int
