"""ServiceGroup repository."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.service_group import ServiceGroup


class ServiceGroupRepository:
    """Data access for ServiceGroup model."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, group_id: uuid.UUID) -> ServiceGroup | None:
        stmt = select(ServiceGroup).where(ServiceGroup.id == group_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list(self) -> list[ServiceGroup]:
        stmt = select(ServiceGroup).order_by(ServiceGroup.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, data: dict) -> ServiceGroup:
        group = ServiceGroup(**data)
        self.db.add(group)
        await self.db.flush()
        await self.db.refresh(group)
        return group

    async def update(self, group: ServiceGroup, data: dict) -> ServiceGroup:
        for key, value in data.items():
            setattr(group, key, value)
        await self.db.flush()
        await self.db.refresh(group)
        return group

    async def delete(self, group: ServiceGroup) -> None:
        await self.db.delete(group)
        await self.db.flush()
