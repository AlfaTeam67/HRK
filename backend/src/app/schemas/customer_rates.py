"""CustomerRate schemas."""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import ORMBaseSchema


class CustomerRateCreate(BaseModel):
    """Request payload for creating a customer rate."""

    contract_service_id: uuid.UUID
    valorization_id: uuid.UUID | None = None
    year: int
    base_price: Decimal
    discount_pct: Decimal = Field(default=Decimal("0.00"))


class CustomerRateUpdate(BaseModel):
    """Request payload for partial update of a customer rate."""

    contract_service_id: uuid.UUID | None = None
    valorization_id: uuid.UUID | None = None
    year: int | None = None
    base_price: Decimal | None = None
    discount_pct: Decimal | None = None


class CustomerRateRead(ORMBaseSchema):
    """CustomerRate API response."""

    id: uuid.UUID
    contract_service_id: uuid.UUID
    valorization_id: uuid.UUID | None
    year: int
    base_price: Decimal
    discount_pct: Decimal
    created_by: uuid.UUID | None
    created_at: datetime
