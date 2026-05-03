"""Valorization business service."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.models.enums import ValorizationStatus
from app.models.rate import Valorization
from app.repo.valorizations import ValorizationRepository
from app.schemas.valorizations import ValorizationCreate, ValorizationUpdate


class ValorizationCrudService:
    """Business operations for valorizations."""

    def __init__(self, val_repo: ValorizationRepository) -> None:
        self.valorizations = val_repo

    async def list_valorizations(
        self,
        *,
        contract_id: uuid.UUID | None,
        year: int | None,
        status_: ValorizationStatus | None,
    ) -> list[Valorization]:
        return await self.valorizations.list(contract_id=contract_id, year=year, status=status_)

    async def get_valorization(self, valorization_id: uuid.UUID) -> Valorization:
        val = await self.valorizations.get(valorization_id)
        if not val:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Valorization not found"
            )
        return val

    async def create_valorization(self, payload: ValorizationCreate) -> Valorization:
        data = payload.model_dump()
        try:
            return await self.valorizations.create(data)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Valorization create failed due to constraint violation",
            ) from exc

    async def update_valorization(
        self, valorization_id: uuid.UUID, payload: ValorizationUpdate
    ) -> Valorization:
        val = await self.get_valorization(valorization_id)
        data = payload.model_dump(exclude_unset=True)
        try:
            return await self.valorizations.update(val, data)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Valorization update failed due to constraint violation",
            ) from exc

    async def delete_valorization(self, valorization_id: uuid.UUID) -> None:
        val = await self.get_valorization(valorization_id)
        try:
            await self.valorizations.delete(val)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Valorization delete failed due to constraint violation",
            ) from exc
