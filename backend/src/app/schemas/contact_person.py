"""ContactPerson schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ContactPersonBase(BaseModel):
    """Base schema for ContactPerson."""

    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=20)
    role: str | None = Field(None, max_length=100)  # np. "Dyrektor HR", "Główna księgowa"
    is_primary: bool = False
    is_contract_signer: bool = False


class ContactPersonCreate(ContactPersonBase):
    """Schema for creating a ContactPerson."""

    customer_id: UUID


class ContactPersonUpdate(BaseModel):
    """Schema for updating a ContactPerson."""

    first_name: str | None = Field(None, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=20)
    role: str | None = Field(None, max_length=100)
    is_primary: bool | None = None
    is_contract_signer: bool | None = None


class ContactPersonRead(ContactPersonBase):
    """Schema for reading a ContactPerson."""

    id: UUID
    customer_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
