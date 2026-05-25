"""GUS BDL CPI service."""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import httpx
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.repo.gus import GusCpiRepository

logger = logging.getLogger(__name__)

_CACHE_TTL = timedelta(hours=24)
_cache: _Snapshot | None = None


@dataclass(frozen=True)
class _Snapshot:
    value: float
    year: int
    quarter: int
    source: str
    fetched_at: datetime
    cached_at: datetime


class GUSService:
    BASE_URL = "https://bdl.stat.gov.pl/api/v1"
    SOURCE = "GUS BDL"
    VARIABLE_ID = 217230

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = GusCpiRepository(db)
        self._headers: dict[str, str] = {"Accept": "application/json"}
        if settings.gus_client_id:
            self._headers["X-ClientId"] = settings.gus_client_id

    async def get_latest_snapshot(self) -> _Snapshot:
        global _cache
        if _cache and datetime.now(UTC) - _cache.cached_at < _CACHE_TTL:
            return _cache

        try:
            snapshot = await self._fetch()
        except Exception as exc:
            logger.warning("GUS API unavailable (%s), falling back to DB", exc)
            stored = await self.repo.get_latest()
            if stored:
                _cache = _Snapshot(
                    value=float(stored.value),
                    year=stored.year,
                    quarter=stored.quarter,
                    source=stored.source,
                    fetched_at=stored.fetched_at,
                    cached_at=datetime.now(UTC),
                )
                return _cache
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="GUS API unavailable and no stored data",
            ) from exc

        try:
            await self.repo.upsert(
                id=uuid.uuid4(),
                year=snapshot.year,
                quarter=snapshot.quarter,
                value=Decimal(str(snapshot.value)),
                source=snapshot.source,
                fetched_at=snapshot.fetched_at,
            )
        except Exception as exc:
            logger.warning("Failed to persist CPI to DB: %s", exc)
            await self.db.rollback()

        _cache = snapshot
        return snapshot

    async def _fetch(self) -> _Snapshot:
        current_year = datetime.now(UTC).year
        for year in range(current_year, current_year - 3, -1):
            values = await self._fetch_year(year)
            if not values:
                continue
            candidates = [v for v in values if v.get("val") is not None]
            if not candidates:
                continue
            latest = max(candidates, key=lambda v: int(v.get("year") or year))
            raw = Decimal(str(latest["val"]).replace(",", "."))
            if raw >= 20:
                raw -= 100
            now = datetime.now(UTC)
            return _Snapshot(
                value=float(raw.quantize(Decimal("0.01"))),
                year=int(latest.get("year") or year),
                quarter=1,
                source=self.SOURCE,
                fetched_at=now,
                cached_at=now,
            )
        raise ValueError("No CPI data from GUS")

    async def _fetch_year(self, year: int) -> list[dict[str, Any]]:
        url = f"{self.BASE_URL}/data/by-variable/{self.VARIABLE_ID}"
        params = {"format": "json", "unit-level": 0, "year": year, "page-size": 5}
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, headers=self._headers) as c:
            r = await c.get(url, params=params)
            r.raise_for_status()
        values: list[dict[str, Any]] = []
        for result in r.json().get("results", []):
            values.extend(result.get("values", []) or [])
        return values
