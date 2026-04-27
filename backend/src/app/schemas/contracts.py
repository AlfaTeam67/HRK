"""Contract schemas."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.enums import BillingCycle, ContractStatus, ContractType
from app.schemas.common import ORMBaseSchema


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
