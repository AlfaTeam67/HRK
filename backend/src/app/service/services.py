"""Service business service."""

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.models.service import Service
from app.repo.lookups import LookupRepository
from app.repo.services import ServiceRepository
from app.schemas.services import ServiceCreate, ServiceUpdate


class ServiceCrudService:
    """Business operations for billable services."""

    def __init__(self, service_repo: ServiceRepository, lookup_repo: LookupRepository) -> None:
        self.services = service_repo
        self.lookup = lookup_repo

    async def list_services(self, **kwargs) -> list[Service]:
        return await self.services.list(**kwargs)

    async def get_service(self, service_id: uuid.UUID) -> Service:
        service = await self.services.get(service_id)
        if not service:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
        return service

    async def create_service(self, payload: ServiceCreate) -> Service:
        data = payload.model_dump()
        await self._validate_service_refs(data)
        try:
            return await self.services.create(data)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Service create failed due to constraint violation",
            ) from exc

    async def update_service(self, service_id: uuid.UUID, payload: ServiceUpdate) -> Service:
        service = await self.get_service(service_id)
        data = payload.model_dump(exclude_unset=True)
        await self._validate_service_refs(data)
        try:
            return await self.services.update(service, data)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Service update failed due to constraint violation",
            ) from exc

    async def delete_service(self, service_id: uuid.UUID) -> None:
        service = await self.get_service(service_id)
        service.deleted_at = datetime.now(UTC)

    async def _validate_service_refs(self, data: dict) -> None:
        group_id = data.get("group_id")
        if group_id and not await self.lookup.service_group_exists(group_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service group not found",
            )
