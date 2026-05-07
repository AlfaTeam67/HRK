import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class AlertRead(BaseModel):
    id: uuid.UUID
    type: Literal[
        "contract_expiry_30",
        "contract_expiry_60",
        "contract_expiry_90",
        "valorization_overdue",
        "valorization_pending",
        "no_contact",
    ]
    severity: Literal["urgent", "high", "medium"]
    title: str
    detail: str
    contract_id: uuid.UUID | None
    customer_id: uuid.UUID | None
    due_date: date | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
