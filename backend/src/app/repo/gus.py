"""GUS CPI repository."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gus import GusCpiSnapshot


class GusCpiRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_latest(self) -> GusCpiSnapshot | None:
        stmt = (
            select(GusCpiSnapshot)
            .order_by(GusCpiSnapshot.year.desc(), GusCpiSnapshot.quarter.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert(
        self,
        *,
        id: uuid.UUID,
        year: int,
        quarter: int,
        value: Decimal,
        source: str,
        fetched_at: datetime,
    ) -> None:
        stmt = (
            insert(GusCpiSnapshot)
            .values(id=id, year=year, quarter=quarter, value=value, source=source, fetched_at=fetched_at)
            .on_conflict_do_update(
                constraint="uq_gus_cpi_snapshots_year_quarter",
                set_={"value": value, "source": source, "fetched_at": fetched_at},
            )
        )
        await self.db.execute(stmt)
        await self.db.flush()
