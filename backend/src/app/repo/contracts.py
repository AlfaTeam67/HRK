"""Contract repository."""

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract import Contract
from app.models.customer import Customer


class ContractRepository:
    """Data access for Contract model."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, contract_id: uuid.UUID) -> Contract | None:
        stmt = select(Contract).where(Contract.id == contract_id, Contract.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list(
        self,
        *,
        company_id: uuid.UUID | None,
        statuses: list[str] | None,
        start_from: date | None,
        start_to: date | None,
        end_from: date | None,
        end_to: date | None,
    ) -> list[Contract]:
        stmt = (
            select(Contract)
            .join(Customer, Customer.id == Contract.customer_id)
            .where(Contract.deleted_at.is_(None), Customer.deleted_at.is_(None))
        )
        if company_id:
            stmt = stmt.where(Customer.company_id == company_id)
        if statuses:
            stmt = stmt.where(Contract.status.in_(statuses))
        if start_from:
            stmt = stmt.where(Contract.start_date >= start_from)
        if start_to:
            stmt = stmt.where(Contract.start_date <= start_to)
        if end_from:
            stmt = stmt.where(Contract.end_date >= end_from)
        if end_to:
            stmt = stmt.where(Contract.end_date <= end_to)
        stmt = stmt.order_by(Contract.start_date.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, data: dict) -> Contract:
        contract = Contract(**data)
        self.db.add(contract)
        await self.db.flush()
        await self.db.refresh(contract)
        return contract

    async def update(self, contract: Contract, data: dict) -> Contract:
        for key, value in data.items():
            setattr(contract, key, value)
        await self.db.flush()
        await self.db.refresh(contract)
        return contract
