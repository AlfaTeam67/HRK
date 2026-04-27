from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import CustomerStatus

class CustomerBase(BaseModel):
    ckk: str
    ckd: Optional[str] = None
    company_id: Optional[UUID] = None
    account_manager_id: UUID
    status: CustomerStatus = CustomerStatus.ACTIVE
    segment: Optional[str] = None
    industry: Optional[str] = None
    employee_count: Optional[int] = None
    payment_period_days: Optional[int] = 21
    account_number: Optional[str] = None
    billing_nip: Optional[str] = None
    billing_email: Optional[str] = None
    invoice_nip: Optional[str] = None
    phone: Optional[str] = None
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_postal: Optional[str] = None
    address_country: Optional[str] = "PL"
    additional_data: dict = Field(default_factory=dict)

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    ckk: Optional[str] = None
    ckd: Optional[str] = None
    company_id: Optional[UUID] = None
    account_manager_id: Optional[UUID] = None
    status: Optional[CustomerStatus] = None
    segment: Optional[str] = None
    industry: Optional[str] = None
    employee_count: Optional[int] = None
    payment_period_days: Optional[int] = None
    account_number: Optional[str] = None
    billing_nip: Optional[str] = None
    billing_email: Optional[str] = None
    invoice_nip: Optional[str] = None
    phone: Optional[str] = None
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_postal: Optional[str] = None
    address_country: Optional[str] = None
    additional_data: Optional[dict] = None

class CustomerResponse(CustomerBase):
    id: UUID
    model_config = ConfigDict(from_attributes=True)
