"""Pydantic schemas for CRM CRUD API."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    BillingCycle,
    BillingFrequency,
    BillingUnit,
    ContractStatus,
    ContractType,
    CustomerStatus,
)


class ORMBaseSchema(BaseModel):
    """Schema base configured for SQLAlchemy model serialization."""

    model_config = ConfigDict(from_attributes=True)


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


class ContractCreate(BaseModel):
    """Request payload for creating a contract."""

    customer_id: uuid.UUID
    account_manager_id: uuid.UUID | None = None
    contract_number: str = Field(min_length=1, max_length=50)
    contract_type: ContractType
    status: ContractStatus = ContractStatus.DRAFT
    start_date: date
    end_date: date | None = None
    notice_period_days: int | None = None
    notice_conditions: str | None = None
    billing_cycle: BillingCycle | None = None
    governing_law: str | None = Field(default=None, max_length=10)
    parent_contract_id: uuid.UUID | None = None
    notes: str | None = None
    additional_data: dict = Field(default_factory=dict)


class ContractUpdate(BaseModel):
    """Request payload for partial update of contract."""

    customer_id: uuid.UUID | None = None
    account_manager_id: uuid.UUID | None = None
    contract_number: str | None = Field(default=None, min_length=1, max_length=50)
    contract_type: ContractType | None = None
    status: ContractStatus | None = None
    start_date: date | None = None
    end_date: date | None = None
    notice_period_days: int | None = None
    notice_conditions: str | None = None
    billing_cycle: BillingCycle | None = None
    governing_law: str | None = Field(default=None, max_length=10)
    parent_contract_id: uuid.UUID | None = None
    notes: str | None = None
    additional_data: dict | None = None


class ContractRead(ORMBaseSchema):
    """Contract API response."""

    id: uuid.UUID
    customer_id: uuid.UUID
    account_manager_id: uuid.UUID | None
    contract_number: str
    contract_type: ContractType
    status: ContractStatus
    start_date: date
    end_date: date | None
    notice_period_days: int | None
    notice_conditions: str | None
    billing_cycle: BillingCycle | None
    governing_law: str | None
    parent_contract_id: uuid.UUID | None
    notes: str | None
    additional_data: dict
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


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


class ContractServiceCreate(BaseModel):
    """Request payload for attaching service to contract."""

    service_id: uuid.UUID
    scope_description: str | None = None
    volume_limit: int | None = None
    volume_unit: str | None = Field(default=None, max_length=20)
    sla_definition: str | None = None
    is_billable: bool = True
    valid_from: date
    valid_to: date | None = None
    additional_data: dict = Field(default_factory=dict)


class ContractServiceRead(ORMBaseSchema):
    """Contract-service relation API response."""

    id: uuid.UUID
    contract_id: uuid.UUID
    service_id: uuid.UUID
    scope_description: str | None
    volume_limit: int | None
    volume_unit: str | None
    sla_definition: str | None
    is_billable: bool
    valid_from: date
    valid_to: date | None
    additional_data: dict


class MessageResponse(BaseModel):
    """Simple message response schema."""

    message: str
