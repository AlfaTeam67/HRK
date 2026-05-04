from uuid import UUID

from pydantic import BaseModel

from app.models.enums import UserRole


class AccessAssignmentsRead(BaseModel):
    user_id: UUID
    roles: list[UserRole]
    company_ids: list[UUID]
    contract_ids: list[UUID]


class RolesUpdateRequest(BaseModel):
    roles: list[UserRole]


class ScopeUpdateRequest(BaseModel):
    ids: list[UUID]
