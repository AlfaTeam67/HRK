"""Contract-service relation schemas."""

import uuid
from datetime import date

from pydantic import BaseModel, Field

from app.schemas.common import ORMBaseSchema


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
