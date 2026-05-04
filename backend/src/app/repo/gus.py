"""GUS CPI snapshot repository."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gus import GusCpiSnapshot


class GusCpiRepository:
    """Data access for GUS CPI snapshots."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_latest(self) -> GusCpiSnapshot | None:
        stmt = (
            select(GusCpiSnapshot)
            .order_by(
                GusCpiSnapshot.year.desc(),
                GusCpiSnapshot.quarter.desc(),
                GusCpiSnapshot.fetched_at.desc(),
            )
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_period(self, *, year: int, quarter: int) -> GusCpiSnapshot | None:
        stmt = select(GusCpiSnapshot).where(
            GusCpiSnapshot.year == year,
            GusCpiSnapshot.quarter == quarter,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert(
        self,
        *,
        year: int,
        quarter: int,
        value: Decimal,
        source: str,
        fetched_at: datetime,
    ) -> GusCpiSnapshot:
        existing = await self.get_by_period(year=year, quarter=quarter)
        if existing:
            existing.value = value
            existing.source = source
            existing.fetched_at = fetched_at
            await self.db.flush()
            await self.db.refresh(existing)
            return existing

        entry = GusCpiSnapshot(
            year=year,
            quarter=quarter,
            value=value,
            source=source,
            fetched_at=fetched_at,
        )
        self.db.add(entry)
        await self.db.flush()
        await self.db.refresh(entry)
        return entry
