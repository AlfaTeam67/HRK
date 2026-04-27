"""Valorization schemas."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import IndexType, ValorizationStatus
from app.schemas.common import ORMBaseSchema


class ValorizationCreate(BaseModel):
    """Request payload for creating a valorization."""

    contract_id: uuid.UUID
    year: int
    index_type: IndexType
    index_value: Decimal
    planned_date: date
    applied_date: date | None = None
    status: ValorizationStatus = ValorizationStatus.PENDING
    approved_by: uuid.UUID | None = None
    notes: str | None = None
    additional_data: dict = Field(default_factory=dict)


class ValorizationUpdate(BaseModel):
    """Request payload for partial update of a valorization."""

    contract_id: uuid.UUID | None = None
    year: int | None = None
    index_type: IndexType | None = None
    index_value: Decimal | None = None
    planned_date: date | None = None
    applied_date: date | None = None
    status: ValorizationStatus | None = None
    approved_by: uuid.UUID | None = None
    notes: str | None = None
    additional_data: dict | None = None


class ValorizationRead(ORMBaseSchema):
    """Valorization API response."""

    id: uuid.UUID
    contract_id: uuid.UUID
    year: int
    index_type: IndexType
    index_value: Decimal
    planned_date: date
    applied_date: date | None
    status: ValorizationStatus
    approved_by: uuid.UUID | None
    notes: str | None
    additional_data: dict
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
