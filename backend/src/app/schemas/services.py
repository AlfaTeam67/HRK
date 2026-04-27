"""Service schemas."""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import BillingFrequency, BillingUnit
from app.schemas.common import ORMBaseSchema


class ServiceCreate(BaseModel):
    """Request payload for creating a service."""

    group_id: uuid.UUID
    name: str = Field(min_length=1, max_length=255)
    billing_unit: BillingUnit
    billing_frequency: BillingFrequency = BillingFrequency.MONTHLY
    vat_rate: Decimal | None = None
    is_active: bool = True
    additional_data: dict = Field(default_factory=dict)


class ServiceUpdate(BaseModel):
    """Request payload for partial update of service."""

    group_id: uuid.UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    billing_unit: BillingUnit | None = None
    billing_frequency: BillingFrequency | None = None
    vat_rate: Decimal | None = None
    is_active: bool | None = None
    additional_data: dict | None = None


class ServiceRead(ORMBaseSchema):
    """Service API response."""

    id: uuid.UUID
    group_id: uuid.UUID
    name: str
    billing_unit: BillingUnit
    billing_frequency: BillingFrequency
    vat_rate: Decimal | None
    is_active: bool
    additional_data: dict
    created_at: datetime
    deleted_at: datetime | None
