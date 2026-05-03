"""Activity log repository."""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityLog


class ActivityLogRepository:
    """Data access for ActivityLog model."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_customer(self, customer_id: uuid.UUID, limit: int, offset: int) -> list[ActivityLog]:
        stmt = (
            select(ActivityLog)
            .where(ActivityLog.customer_id == customer_id)
            .order_by(ActivityLog.activity_date.desc(), ActivityLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_contract(self, contract_id: uuid.UUID, limit: int, offset: int) -> list[ActivityLog]:
        stmt = (
            select(ActivityLog)
            .where(ActivityLog.contract_id == contract_id)
            .order_by(ActivityLog.activity_date.desc(), ActivityLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, data: dict[str, Any], performed_by: uuid.UUID | None) -> ActivityLog:
        payload = dict(data)
        payload["performed_by"] = performed_by

        activity = ActivityLog(**payload)
        self.db.add(activity)
        await self.db.flush()
        await self.db.refresh(activity)
        return activity
