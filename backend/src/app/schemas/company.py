from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CompanyBase(BaseModel):
    name: str = Field(..., max_length=255)
    nip: str | None = Field(None, max_length=15)
    regon: str | None = Field(None, max_length=14)
    krs: str | None = Field(None, max_length=20)
    address_street: str | None = Field(None, max_length=255)
    address_city: str | None = Field(None, max_length=255)
    address_postal: str | None = Field(None, max_length=10)
    address_country: str | None = Field("PL", max_length=2)
    phone: str | None = Field(None, max_length=20)
    email: EmailStr | None = None
    website: str | None = Field(None, max_length=255)
    is_active: bool = True
    additional_data: dict[str, Any] = Field(default_factory=dict)


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    nip: str | None = Field(None, max_length=15)
    regon: str | None = Field(None, max_length=14)
    krs: str | None = Field(None, max_length=20)
    address_street: str | None = Field(None, max_length=255)
    address_city: str | None = Field(None, max_length=255)
    address_postal: str | None = Field(None, max_length=10)
    address_country: str | None = Field(None, max_length=2)
    phone: str | None = Field(None, max_length=20)
    email: EmailStr | None = None
    website: str | None = Field(None, max_length=255)
    is_active: bool | None = None
    additional_data: dict[str, Any] | None = None


class CompanyRead(CompanyBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
