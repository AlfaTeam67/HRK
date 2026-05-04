"""Customer schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import CustomerStatus
from app.schemas.common import ORMBaseSchema


class CustomerCreate(BaseModel):
    """Request payload for creating a customer."""

    ckk: str = Field(min_length=1, max_length=10)
    ckd: str | None = Field(default=None, max_length=10)
    company_id: uuid.UUID | None = None
    account_manager_id: uuid.UUID
    status: CustomerStatus = CustomerStatus.ACTIVE
    segment: str | None = Field(default=None, max_length=50)
    industry: str | None = Field(default=None, max_length=100)
    employee_count: int | None = None
    payment_period_days: int | None = None
    account_number: str | None = Field(default=None, max_length=30)
    billing_nip: str | None = Field(default=None, max_length=15)
    billing_email: str | None = Field(default=None, max_length=255)
    invoice_nip: str | None = Field(default=None, max_length=15)
    phone: str | None = Field(default=None, max_length=20)
    address_street: str | None = Field(default=None, max_length=255)
    address_city: str | None = Field(default=None, max_length=255)
    address_postal: str | None = Field(default=None, max_length=10)
    address_country: str | None = Field(default=None, max_length=2)
    additional_data: dict = Field(default_factory=dict)


class CustomerUpdate(BaseModel):
    """Request payload for partial update of customer."""

    ckk: str | None = Field(default=None, min_length=1, max_length=10)
    ckd: str | None = Field(default=None, max_length=10)
    company_id: uuid.UUID | None = None
    account_manager_id: uuid.UUID | None = None
    status: CustomerStatus | None = None
    segment: str | None = Field(default=None, max_length=50)
    industry: str | None = Field(default=None, max_length=100)
    employee_count: int | None = None
    payment_period_days: int | None = None
    account_number: str | None = Field(default=None, max_length=30)
    billing_nip: str | None = Field(default=None, max_length=15)
    billing_email: str | None = Field(default=None, max_length=255)
    invoice_nip: str | None = Field(default=None, max_length=15)
    phone: str | None = Field(default=None, max_length=20)
    address_street: str | None = Field(default=None, max_length=255)
    address_city: str | None = Field(default=None, max_length=255)
    address_postal: str | None = Field(default=None, max_length=10)
    address_country: str | None = Field(default=None, max_length=2)
    additional_data: dict | None = None


class CustomerRead(ORMBaseSchema):
    """Customer API response."""

    id: uuid.UUID
    ckk: str
    ckd: str | None
    company_id: uuid.UUID | None
    company_name: str | None = None
    account_manager_id: uuid.UUID
    status: CustomerStatus
    segment: str | None
    industry: str | None
    employee_count: int | None
    payment_period_days: int | None
    account_number: str | None
    billing_nip: str | None
    billing_email: str | None
    invoice_nip: str | None
    phone: str | None
    address_street: str | None
    address_city: str | None
    address_postal: str | None
    address_country: str | None
    additional_data: dict
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
