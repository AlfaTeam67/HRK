"""PriceListTemplate schemas."""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import ORMBaseSchema


class PriceListTemplateCreate(BaseModel):
    """Request payload for creating a price list entry."""

    service_id: uuid.UUID
    list_price: Decimal = Field(gt=0, decimal_places=2)
    description: str | None = Field(default=None, max_length=500)
    label: str | None = Field(default=None, max_length=100)
    is_active: bool = True


class PriceListTemplateUpdate(BaseModel):
    """Request payload for partial update of a price list entry."""

    list_price: Decimal | None = Field(default=None, gt=0, decimal_places=2)
    description: str | None = Field(default=None, max_length=500)
    label: str | None = Field(default=None, max_length=100)
    is_active: bool | None = None


class PriceListTemplateRead(ORMBaseSchema):
    """Price list entry API response."""

    id: uuid.UUID
    service_id: uuid.UUID
    list_price: Decimal
    description: str | None
    label: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
