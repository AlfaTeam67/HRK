"""Timeline repository for aggregated customer events."""

import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityLog
from app.models.alert import Alert
from app.models.contract import Contract
from app.models.note import Note
from app.models.rate import Valorization


class TimelineRepository:
    """Data access for customer timeline aggregation."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_contracts(self, customer_id: uuid.UUID) -> list[Contract]:
        stmt = select(Contract).where(Contract.customer_id == customer_id, Contract.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_valorizations(self, contract_ids: list[uuid.UUID]) -> list[Valorization]:
        if not contract_ids:
            return []
        stmt = select(Valorization).where(Valorization.contract_id.in_(contract_ids))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_notes(self, customer_id: uuid.UUID, contract_ids: list[uuid.UUID]) -> list[Note]:
        conditions = [Note.customer_id == customer_id]
        if contract_ids:
            conditions.append(Note.contract_id.in_(contract_ids))
        stmt = select(Note).where(or_(*conditions), Note.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_alerts(self, customer_id: uuid.UUID, contract_ids: list[uuid.UUID]) -> list[Alert]:
        conditions = [Alert.customer_id == customer_id]
        if contract_ids:
            conditions.append(Alert.contract_id.in_(contract_ids))
        stmt = select(Alert).where(or_(*conditions))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_activity_logs(self, customer_id: uuid.UUID) -> list[ActivityLog]:
        stmt = select(ActivityLog).where(ActivityLog.customer_id == customer_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
