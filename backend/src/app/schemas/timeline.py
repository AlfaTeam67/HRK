"""Customer timeline schemas."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

TimelineEventType = Literal[
    "contract_signed",
    "valorization_approved",
    "valorization_started",
    "note_added",
    "meeting",
    "call",
    "email",
    "document",
    "verification",
    "system",
    "alert_triggered",
]


class TimelineEventRead(BaseModel):
    id: uuid.UUID
    timestamp: datetime
    event_type: TimelineEventType
    title: str
    detail: str | None = None
    author: str | None = None
    contract_id: uuid.UUID | None = None
    valorization_id: uuid.UUID | None = None
    metadata: dict | None = None
