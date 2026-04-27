from typing import Optional
from uuid import UUID
from datetime import date
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ContractType, ContractStatus, BillingCycle

class ContractBase(BaseModel):
    customer_id: UUID
    account_manager_id: Optional[UUID] = None
    contract_number: str
    contract_type: ContractType
    status: ContractStatus = ContractStatus.DRAFT
    start_date: date
    end_date: Optional[date] = None
    notice_period_days: Optional[int] = 90
    notice_conditions: Optional[str] = None
    billing_cycle: Optional[BillingCycle] = BillingCycle.MONTHLY
    governing_law: Optional[str] = "PL"
    parent_contract_id: Optional[UUID] = None
    notes: Optional[str] = None
    additional_data: dict = Field(default_factory=dict)

class ContractCreate(ContractBase):
    pass

class ContractUpdate(BaseModel):
    customer_id: Optional[UUID] = None
    account_manager_id: Optional[UUID] = None
    contract_number: Optional[str] = None
    contract_type: Optional[ContractType] = None
    status: Optional[ContractStatus] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notice_period_days: Optional[int] = None
    notice_conditions: Optional[str] = None
    billing_cycle: Optional[BillingCycle] = None
    governing_law: Optional[str] = None
    parent_contract_id: Optional[UUID] = None
    notes: Optional[str] = None
    additional_data: Optional[dict] = None

class ContractResponse(ContractBase):
    id: UUID
    model_config = ConfigDict(from_attributes=True)
