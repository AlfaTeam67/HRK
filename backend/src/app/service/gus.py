"""GUS BDL CPI integration service."""

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

@dataclass(frozen=True)
class GusCpiSnapshotData:
    value: float
    year: int
    quarter: int
    source: str
    fetched_at: datetime
    cached_at: datetime

_cache: GusCpiSnapshotData | None = None

class GUSService:
    BASE_URL = "https://bdl.stat.gov.pl/api/v1"
    SOURCE = "GUS BDL"

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = GusCpiRepository(db)
        self.variable_id = settings.gus_cpi_variable_id

    async def get_cpi(self, year: int | None = None) -> float:
        target_year = year or datetime.now(UTC).year
        values = await self._fetch_values_for_year(target_year)
        cpi_value, _year, _quarter = self._select_latest(values, fallback_year=target_year)
        return cpi_value

    async def get_latest_cpi(self) -> tuple[float, int, int]:
        snapshot = await self.get_latest_snapshot()
        return snapshot.value, snapshot.year, snapshot.quarter

    async def get_latest_snapshot(self) -> GusCpiSnapshotData:
        cached = self._get_cached_snapshot()
        if cached:
            return cached

        try:
            snapshot = await self._fetch_latest_snapshot()
        except Exception as exc:
            logger.warning("GUS API unavailable, falling back to stored database CPI", exc_info=exc)
            stored = await self.repo.get_latest()
            if stored:
                snapshot = GusCpiSnapshotData(
                    value=float(stored.value),
                    year=stored.year,
                    quarter=stored.quarter,
                    source=stored.source,
                    fetched_at=stored.fetched_at,
                    cached_at=datetime.now(UTC),
                )
                self._set_cache(snapshot)
                return snapshot

            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="GUS API unavailable and no stored data in database",
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
            logger.warning("Failed to persist CPI snapshot to database", exc_info=exc)
            await self.db.rollback()

        self._set_cache(snapshot)
        return snapshot

    def _get_cached_snapshot(self) -> GusCpiSnapshotData | None:
        global _cache
        if not _cache:
            return None
        if datetime.now(UTC) - _cache.cached_at > _CACHE_TTL:
            _cache = None
            return None
        return _cache

    def _set_cache(self, snapshot: GusCpiSnapshotData) -> None:
        global _cache
        _cache = snapshot

    async def _fetch_latest_snapshot(self) -> GusCpiSnapshotData:
        current_year = datetime.now(UTC).year
        last_error: Exception | None = None

        for year in range(current_year, current_year - 3, -1):
            try:
                values = await self._fetch_values_for_year(year)
            except Exception as exc:
                last_error = exc
                continue

            if not values:
                continue

            cpi_value, selected_year, quarter = self._select_latest(values, fallback_year=year)
            fetched_at = datetime.now(UTC)
            return GusCpiSnapshotData(
                value=cpi_value,
                year=selected_year,
                quarter=quarter,
                source=self.SOURCE,
                fetched_at=fetched_at,
                cached_at=fetched_at,
            )

        if last_error:
            raise last_error
        raise ValueError(f"No CPI values returned for variable {self.variable_id}")

    async def _fetch_values_for_year(self, year: int) -> list[dict[str, Any]]:
        params = {
            "format": "json",
            "unit-level": 0,
            "year": year,
            "page-size": 10,
        }
        url = f"{self.BASE_URL}/data/by-variable/{self.variable_id}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()

        payload = response.json()
        results = payload.get("results", [])
        values: list[dict[str, Any]] = []
        for result in results:
            values.extend(result.get("values", []) or [])
        return values

    def _select_latest(
        self, values: list[dict[str, Any]], *, fallback_year: int
    ) -> tuple[float, int, int]:
        candidates = [v for v in values if v.get("val") is not None]
        if not candidates:
            raise ValueError(f"No valid values in GUS response")

        def sort_key(entry: dict[str, Any]) -> tuple[int, int]:
            year = int(entry.get("year") or fallback_year)
            period = self._extract_quarter(entry)
            return year, period

        latest = max(candidates, key=sort_key)
        raw_value_str = str(latest.get("val")).replace(",", ".")
        raw_value = Decimal(raw_value_str)
        year = int(latest.get("year") or fallback_year)
        quarter = self._extract_quarter(latest)

        if raw_value >= Decimal("20"):
            raw_value -= Decimal("100")

        return float(raw_value.quantize(Decimal("0.01"))), year, quarter

    def _extract_quarter(self, entry: dict[str, Any]) -> int:
        raw = entry.get("quarter") or entry.get("period") or entry.get("month")
        if raw is None:
            return 1
        try:
            value = int(raw)
        except (TypeError, ValueError):
            return 1
        if value > 4:
            return (value - 1) // 3 + 1
        return max(value, 1)