"""Lookup repository for FK and relation checks."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.contract import Contract
from app.models.customer import Customer
from app.models.service_group import ServiceGroup
from app.models.user import User


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

    async def customer_exists(self, customer_id: uuid.UUID) -> bool:
        stmt = select(Customer.id).where(Customer.id == customer_id, Customer.deleted_at.is_(None))
        return (await self.db.execute(stmt)).scalar_one_or_none() is not None

    async def has_customer_contracts(self, customer_id: uuid.UUID) -> bool:
        stmt = select(Contract.id).where(
            Contract.customer_id == customer_id, Contract.deleted_at.is_(None)
        )
        return (await self.db.execute(stmt)).scalar_one_or_none() is not None

    async def contract_exists(self, contract_id: uuid.UUID) -> bool:
        stmt = select(Contract.id).where(Contract.id == contract_id, Contract.deleted_at.is_(None))
        return (await self.db.execute(stmt)).scalar_one_or_none() is not None
