"""Note schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.enums import NoteType
from app.schemas.common import ORMBaseSchema


class NoteCreate(BaseModel):
    """Request payload for creating a note."""

    customer_id: uuid.UUID | None = None
    contract_id: uuid.UUID | None = None
    note_type: NoteType
    content: str = Field(min_length=1)

    @model_validator(mode="after")
    def check_customer_or_contract(self) -> "NoteCreate":
        """Validate that exactly one of customer_id or contract_id is provided."""
        has_customer = self.customer_id is not None
        has_contract = self.contract_id is not None

        if not has_customer and not has_contract:
            raise ValueError("Either customer_id or contract_id must be provided")

        if has_customer and has_contract:
            raise ValueError("Cannot provide both customer_id and contract_id")

        return self


class NoteUpdate(BaseModel):
    """Request payload for partial update of note."""

    note_type: NoteType | None = None
    content: str | None = Field(default=None, min_length=1)


class NoteRead(ORMBaseSchema):
    """Note API response."""

    id: uuid.UUID
    customer_id: uuid.UUID | None
    contract_id: uuid.UUID | None
    note_type: NoteType
    content: str
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
