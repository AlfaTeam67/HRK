"""CustomerRate repository."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rate import CustomerRate


class CustomerRateRepository:
    """Data access for CustomerRate model."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, rate_id: uuid.UUID) -> CustomerRate | None:
        stmt = select(CustomerRate).where(CustomerRate.id == rate_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list(self) -> list[CustomerRate]:
        stmt = select(CustomerRate).order_by(CustomerRate.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, data: dict) -> CustomerRate:
        rate = CustomerRate(**data)
        self.db.add(rate)
        await self.db.flush()
        await self.db.refresh(rate)
        return rate

    async def update(self, rate: CustomerRate, data: dict) -> CustomerRate:
        for key, value in data.items():
            setattr(rate, key, value)
        await self.db.flush()
        await self.db.refresh(rate)
        return rate

    async def delete(self, rate: CustomerRate) -> None:
        await self.db.delete(rate)
        await self.db.flush()
