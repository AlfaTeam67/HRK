from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    login: str = Field(..., max_length=100)
    email: EmailStr


class UserCreate(UserBase):
    pass


class UserUpdate(BaseModel):
    login: str | None = Field(None, max_length=100)
    email: EmailStr | None = None


class UserRead(UserBase):
    id: UUID
    roles: list[str] = []

    model_config = ConfigDict(from_attributes=True)
