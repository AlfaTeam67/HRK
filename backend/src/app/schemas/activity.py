"""Activity log schemas."""

import uuid
from datetime import UTC, datetime

from pydantic import BaseModel, Field

from app.models.enums import ActivityType
from app.schemas.common import ORMBaseSchema


class ActivityLogCreate(BaseModel):
    """Request payload for creating an activity log entry."""

    customer_id: uuid.UUID | None = None
    contract_id: uuid.UUID | None = None
    activity_type: ActivityType
    description: str
    activity_date: datetime = Field(default_factory=lambda: datetime.now(UTC))
    additional_data: dict = Field(default_factory=dict)


class ActivityLogRead(ORMBaseSchema):
    """Activity log API response."""

    id: uuid.UUID
    customer_id: uuid.UUID | None
    contract_id: uuid.UUID | None
    activity_type: ActivityType
    description: str
    performed_by: uuid.UUID | None
    activity_date: datetime
    additional_data: dict
    created_at: datetime
