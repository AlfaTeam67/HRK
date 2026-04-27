from typing import Optional
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel, ConfigDict

class CustomerRateBase(BaseModel):
    contract_service_id: UUID
    valorization_id: Optional[UUID] = None
    year: int
    base_price: Decimal
    discount_pct: Decimal = Decimal("0.00")
    created_by: Optional[UUID] = None

class CustomerRateCreate(CustomerRateBase):
    pass

class CustomerRateUpdate(BaseModel):
    contract_service_id: Optional[UUID] = None
    valorization_id: Optional[UUID] = None
    year: Optional[int] = None
    base_price: Optional[Decimal] = None
    discount_pct: Optional[Decimal] = None
    created_by: Optional[UUID] = None

class CustomerRateResponse(CustomerRateBase):
    id: UUID
    model_config = ConfigDict(from_attributes=True)
