"""Customer AI summary service — generates LLM-based client overview with 1h in-memory cache."""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract import Contract
from app.models.customer import Customer
from app.models.enums import AlertStatus, ContractStatus
from app.models.note import Note
from app.schemas.customers import AiSummaryResponse
from app.service.llm import LLMService

_CACHE_TTL = timedelta(hours=1)

_cache: dict[uuid.UUID, tuple[str, datetime]] = {}


class CustomerAiSummaryService:
    def __init__(self, db: AsyncSession, llm: LLMService) -> None:
        self._db = db
        self._llm = llm

    def _get_cached(self, customer_id: uuid.UUID) -> tuple[str, datetime] | None:
        entry = _cache.get(customer_id)
        if entry is None:
            return None
        text, generated_at = entry
        if datetime.now(UTC) - generated_at > _CACHE_TTL:
            del _cache[customer_id]
            return None
        return text, generated_at

    def invalidate(self, customer_id: uuid.UUID) -> None:
        _cache.pop(customer_id, None)

    async def generate(self, customer_id: uuid.UUID) -> AiSummaryResponse:
        cached = self._get_cached(customer_id)
        if cached:
            text, generated_at = cached
            return AiSummaryResponse(summary=text, generated_at=generated_at)

        stmt = select(Customer).where(Customer.id == customer_id).options(selectinload(Customer.company))
        result = await self._db.execute(stmt)
        customer = result.scalar_one_or_none()
        if customer is None:
            raise ValueError("Customer not found")

        contracts = await self._fetch_active_contracts(customer_id)
        notes = await self._fetch_recent_notes(customer_id, limit=5)
        alerts = await self._fetch_active_alerts(customer_id)

        prompt = self._build_prompt(customer, contracts, notes, alerts)
        summary = await self._llm.summarize(prompt)

        generated_at = datetime.now(UTC)
        _cache[customer_id] = (summary, generated_at)
        return AiSummaryResponse(summary=summary, generated_at=generated_at)

    async def stream(self, customer_id: uuid.UUID) -> AsyncIterator[str]:
        cached = self._get_cached(customer_id)
        if cached:
            text, generated_at = cached
            yield f"data: {json.dumps({'token': text})}\n\n"
            yield f"data: {json.dumps({'done': True, 'generated_at': generated_at.isoformat()})}\n\n"
            return

        stmt = select(Customer).where(Customer.id == customer_id).options(selectinload(Customer.company))
        result = await self._db.execute(stmt)
        customer = result.scalar_one_or_none()
        if customer is None:
            yield f"data: {json.dumps({'error': 'Customer not found'})}\n\n"
            return

        contracts = await self._fetch_active_contracts(customer_id)
        notes = await self._fetch_recent_notes(customer_id, limit=5)
        alerts = await self._fetch_active_alerts(customer_id)
        prompt = self._build_prompt(customer, contracts, notes, alerts)

        chunks: list[str] = []
        async for token in self._llm.stream_summarize(prompt):
            chunks.append(token)
            yield f"data: {json.dumps({'token': token})}\n\n"

        summary = "".join(chunks)
        generated_at = datetime.now(UTC)
        _cache[customer_id] = (summary, generated_at)
        yield f"data: {json.dumps({'done': True, 'generated_at': generated_at.isoformat()})}\n\n"

    async def _fetch_active_contracts(self, customer_id: uuid.UUID) -> list[Contract]:
        stmt = (
            select(Contract)
            .where(
                Contract.customer_id == customer_id,
                Contract.deleted_at.is_(None),
                Contract.status != ContractStatus.TERMINATED,
            )
            .order_by(Contract.end_date.asc())
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def _fetch_recent_notes(self, customer_id: uuid.UUID, *, limit: int) -> list[Note]:
        stmt = (
            select(Note)
            .where(Note.customer_id == customer_id, Note.deleted_at.is_(None))
            .order_by(Note.created_at.desc())
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def _fetch_active_alerts(self, customer_id: uuid.UUID) -> list[str]:
        from app.models.alert import Alert

        stmt = select(Alert).where(
            Alert.customer_id == customer_id,
            Alert.status == AlertStatus.OPEN,
        )
        result = await self._db.execute(stmt)
        return [a.message for a in result.scalars().all()]

    def _build_prompt(
        self,
        customer: Customer,
        contracts: list[Contract],
        notes: list[Note],
        alerts: list[str],
    ) -> str:
        name = customer.company.name if customer.company else customer.ckk
        segment = customer.segment or "nieznany"
        status = customer.status.value if hasattr(customer.status, "value") else str(customer.status)

        contract_lines = []
        for c in contracts:
            end = c.end_date.isoformat() if c.end_date else "brak daty końca"
            contract_lines.append(f"- {c.contract_number} ({c.contract_type.value}), status: {c.status.value}, kończy się: {end}")

        note_lines = [f"- [{n.note_type.value}] {n.content[:200]}" for n in notes]
        alert_lines = [f"- {a}" for a in alerts]

        sections: list[str] = [
            f"Klient: {name}, segment: {segment}, status: {status}",
        ]

        if contract_lines:
            sections.append("Aktywne umowy:\n" + "\n".join(contract_lines))
        else:
            sections.append("Aktywne umowy: brak")

        if note_lines:
            sections.append("Ostatnie aktywności:\n" + "\n".join(note_lines))
        else:
            sections.append("Ostatnie aktywności: brak notatek")

        if alert_lines:
            sections.append("Aktywne alerty:\n" + "\n".join(alert_lines))
        else:
            sections.append("Aktywne alerty: brak")

        return "\n\n".join(sections)
