"""ServiceGroup business service."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.models.service_group import ServiceGroup
from app.repo.service_groups import ServiceGroupRepository
from app.schemas.service_groups import ServiceGroupCreate, ServiceGroupUpdate


class ServiceGroupCrudService:
    """Business operations for service groups."""

    def __init__(self, group_repo: ServiceGroupRepository) -> None:
        self.groups = group_repo

    async def list_groups(self) -> list[ServiceGroup]:
        return await self.groups.list()

    async def get_group(self, group_id: uuid.UUID) -> ServiceGroup:
        group = await self.groups.get(group_id)
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="ServiceGroup not found"
            )
        return group

    async def create_group(self, payload: ServiceGroupCreate) -> ServiceGroup:
        data = payload.model_dump()
        try:
            return await self.groups.create(data)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="ServiceGroup create failed due to constraint violation",
            ) from exc

    async def update_group(self, group_id: uuid.UUID, payload: ServiceGroupUpdate) -> ServiceGroup:
        group = await self.get_group(group_id)
        data = payload.model_dump(exclude_unset=True)
        try:
            return await self.groups.update(group, data)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="ServiceGroup update failed due to constraint violation",
            ) from exc

    async def delete_group(self, group_id: uuid.UUID) -> None:
        group = await self.get_group(group_id)
        try:
            await self.groups.delete(group)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="ServiceGroup delete failed due to constraint violation",
            ) from exc
