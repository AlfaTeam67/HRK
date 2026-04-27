"""Common schema utilities."""

from pydantic import BaseModel, ConfigDict


class ORMBaseSchema(BaseModel):
    """Schema base configured for SQLAlchemy model serialization."""

    model_config = ConfigDict(from_attributes=True)


class MessageResponse(BaseModel):
    """Simple message response schema."""

    message: str
from collections.abc import Sequence
from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


class PaginatedResponse(BaseModel, Generic[T]):
    items: Sequence[T]
    total: int
    page: int
    page_size: int
    pages: int
