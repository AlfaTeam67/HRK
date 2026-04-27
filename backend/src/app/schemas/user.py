from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole


class UserBase(BaseModel):
    ad_username: str = Field(..., max_length=100)
    email: EmailStr
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    department: str | None = Field(None, max_length=100)
    role: UserRole
    is_active: bool = True


class UserCreate(UserBase):
    pass


class UserUpdate(BaseModel):
    ad_username: str | None = Field(None, max_length=100)
    email: EmailStr | None = None
    first_name: str | None = Field(None, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    department: str | None = Field(None, max_length=100)
    role: UserRole | None = None
    is_active: bool | None = None


class UserRead(UserBase):
    id: UUID
    last_login_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
