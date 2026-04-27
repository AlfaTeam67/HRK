"""Repository layer for CRM CRUD operations."""

import uuid
from datetime import date

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.contract import Contract
from app.models.contract_service import ContractService
from app.models.customer import Customer
from app.models.service import Service
from app.models.service_group import ServiceGroup
from app.models.user import User


class CustomerRepository:
    """Data access for Customer model."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, customer_id: uuid.UUID) -> Customer | None:
        stmt = select(Customer).where(Customer.id == customer_id, Customer.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list(
        self,
        *,
        company_id: uuid.UUID | None,
        statuses: list[str] | None,
        created_from: date | None,
        created_to: date | None,
    ) -> list[Customer]:
        stmt = select(Customer).where(Customer.deleted_at.is_(None))
        if company_id:
            stmt = stmt.where(Customer.company_id == company_id)
        if statuses:
            stmt = stmt.where(Customer.status.in_(statuses))
        if created_from:
            stmt = stmt.where(Customer.created_at >= created_from)
        if created_to:
            stmt = stmt.where(Customer.created_at <= created_to)
        stmt = stmt.order_by(Customer.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, data: dict) -> Customer:
        customer = Customer(**data)
        self.db.add(customer)
        await self.db.flush()
        await self.db.refresh(customer)
        return customer

    async def update(self, customer: Customer, data: dict) -> Customer:
        for key, value in data.items():
            setattr(customer, key, value)
        await self.db.flush()
        await self.db.refresh(customer)
        return customer

    async def soft_delete(self, customer: Customer) -> None:
        await self.db.delete(customer)


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

    async def soft_delete(self, contract: Contract) -> None:
        await self.db.delete(contract)


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

    async def soft_delete(self, service: Service) -> None:
        await self.db.delete(service)


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


class LookupRepository:
    """Helper repository for FK existence checks."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def company_exists(self, company_id: uuid.UUID) -> bool:
        stmt = select(Company.id).where(Company.id == company_id, Company.deleted_at.is_(None))
        return (await self.db.execute(stmt)).scalar_one_or_none() is not None

    async def user_exists(self, user_id: uuid.UUID) -> bool:
        stmt = select(User.id).where(User.id == user_id)
        return (await self.db.execute(stmt)).scalar_one_or_none() is not None

    async def service_group_exists(self, group_id: uuid.UUID) -> bool:
        stmt = select(ServiceGroup.id).where(ServiceGroup.id == group_id)
        return (await self.db.execute(stmt)).scalar_one_or_none() is not None

    async def has_customer_contracts(self, customer_id: uuid.UUID) -> bool:
        stmt = select(Contract.id).where(Contract.customer_id == customer_id, Contract.deleted_at.is_(None))
        return (await self.db.execute(stmt)).scalar_one_or_none() is not None
