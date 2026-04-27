from typing import Optional
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import BillingUnit, BillingFrequency

class ServiceBase(BaseModel):
    group_id: UUID
    name: str
    billing_unit: BillingUnit
    billing_frequency: BillingFrequency = BillingFrequency.MONTHLY
    vat_rate: Optional[Decimal] = Decimal("23.00")
    is_active: bool = True
    additional_data: dict = Field(default_factory=dict)

class ServiceCreate(ServiceBase):
    pass

class ServiceUpdate(BaseModel):
    group_id: Optional[UUID] = None
    name: Optional[str] = None
    billing_unit: Optional[BillingUnit] = None
    billing_frequency: Optional[BillingFrequency] = None
    vat_rate: Optional[Decimal] = None
    is_active: Optional[bool] = None
    additional_data: Optional[dict] = None

class ServiceResponse(ServiceBase):
    id: UUID
    model_config = ConfigDict(from_attributes=True)
