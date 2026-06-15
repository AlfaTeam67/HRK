"""PriceListTemplate repository."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.price_list import PriceListTemplate


class PriceListRepository:
    """Data access for PriceListTemplate model."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, template_id: uuid.UUID) -> PriceListTemplate | None:
        stmt = select(PriceListTemplate).where(PriceListTemplate.id == template_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_service(self, service_id: uuid.UUID) -> PriceListTemplate | None:
        stmt = select(PriceListTemplate).where(PriceListTemplate.service_id == service_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        *,
        active_only: bool = False,
        skip: int = 0,
        limit: int = 200,
    ) -> list[PriceListTemplate]:
        stmt = select(PriceListTemplate)
        if active_only:
            stmt = stmt.where(PriceListTemplate.is_active.is_(True))
        stmt = stmt.order_by(PriceListTemplate.created_at.desc()).offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, data: dict) -> PriceListTemplate:
        template = PriceListTemplate(**data)
        self.db.add(template)
        await self.db.flush()
        await self.db.refresh(template)
        return template

    async def update(self, template: PriceListTemplate, data: dict) -> PriceListTemplate:
        for key, value in data.items():
            setattr(template, key, value)
        await self.db.flush()
        await self.db.refresh(template)
        return template

    async def delete(self, template: PriceListTemplate) -> None:
        """Hard delete — use is_active=False for soft deactivation instead."""
        await self.db.delete(template)
        await self.db.flush()
