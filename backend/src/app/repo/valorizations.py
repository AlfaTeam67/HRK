"""Valorization repository."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ValorizationStatus
from app.models.rate import Valorization


class ValorizationRepository:
    """Data access for Valorization model."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, valorization_id: uuid.UUID) -> Valorization | None:
        stmt = select(Valorization).where(Valorization.id == valorization_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list(
        self,
        *,
        contract_id: uuid.UUID | None,
        year: int | None,
        status: ValorizationStatus | None,
    ) -> list[Valorization]:
        stmt = select(Valorization)
        if contract_id:
            stmt = stmt.where(Valorization.contract_id == contract_id)
        if year is not None:
            stmt = stmt.where(Valorization.year == year)
        if status:
            stmt = stmt.where(Valorization.status == status)
        stmt = stmt.order_by(Valorization.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, data: dict) -> Valorization:
        val = Valorization(**data)
        self.db.add(val)
        await self.db.flush()
        await self.db.refresh(val)
        return val

    async def update(self, val: Valorization, data: dict) -> Valorization:
        for key, value in data.items():
            setattr(val, key, value)
        await self.db.flush()
        return val

    async def delete(self, val: Valorization) -> None:
        await self.db.delete(val)
        await self.db.flush()
