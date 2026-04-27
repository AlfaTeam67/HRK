"""ServiceGroup schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMBaseSchema


class ServiceGroupCreate(BaseModel):
    """Request payload for creating a service group."""

    parent_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=255)
    service_code: str | None = Field(default=None, max_length=20)
    level: int = 1
    path_id: str | None = Field(default=None, max_length=50)
    path_name: str | None = Field(default=None, max_length=500)
    is_active: bool = True


class ServiceGroupUpdate(BaseModel):
    """Request payload for partial update of a service group."""

    parent_id: uuid.UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    service_code: str | None = Field(default=None, max_length=20)
    level: int | None = None
    path_id: str | None = Field(default=None, max_length=50)
    path_name: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None


class ServiceGroupRead(ORMBaseSchema):
    """ServiceGroup API response."""

    id: uuid.UUID
    parent_id: uuid.UUID | None
    name: str
    service_code: str | None
    level: int
    path_id: str | None
    path_name: str | None
    is_active: bool
    created_at: datetime
