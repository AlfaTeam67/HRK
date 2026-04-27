"""Service repository."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract import Contract
from app.models.contract_service import ContractService
from app.models.customer import Customer
from app.models.service import Service


class ServiceRepository:
    """Data access for Service model."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, service_id: uuid.UUID) -> Service | None:
        stmt = select(Service).where(Service.id == service_id, Service.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list(self, *, company_id: uuid.UUID | None, is_active: bool | None) -> list[Service]:
        stmt = select(Service).where(Service.deleted_at.is_(None))
        if is_active is not None:
            stmt = stmt.where(Service.is_active.is_(is_active))
        if company_id:
            stmt = (
                stmt.join(ContractService, ContractService.service_id == Service.id)
                .join(Contract, Contract.id == ContractService.contract_id)
                .join(Customer, Customer.id == Contract.customer_id)
                .where(Customer.company_id == company_id)
                .distinct()
            )
        stmt = stmt.order_by(Service.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, data: dict) -> Service:
        service = Service(**data)
        self.db.add(service)
        await self.db.flush()
        await self.db.refresh(service)
        return service

    async def update(self, service: Service, data: dict) -> Service:
        for key, value in data.items():
            setattr(service, key, value)
        await self.db.flush()
        await self.db.refresh(service)
        return service
