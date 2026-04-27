"""Contract-service relation repository."""

import uuid

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract_service import ContractService


class ContractServiceRepository:
    """Data access for ContractService relation."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_for_contract(self, contract_id: uuid.UUID) -> list[ContractService]:
        stmt = select(ContractService).where(ContractService.contract_id == contract_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_for_contract(
        self,
        *,
        contract_id: uuid.UUID,
        relation_id: uuid.UUID,
    ) -> ContractService | None:
        stmt = select(ContractService).where(
            and_(ContractService.id == relation_id, ContractService.contract_id == contract_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, data: dict) -> ContractService:
        relation = ContractService(**data)
        self.db.add(relation)
        await self.db.flush()
        await self.db.refresh(relation)
        return relation

    async def delete(self, relation: ContractService) -> None:
        await self.db.delete(relation)
        await self.db.flush()
