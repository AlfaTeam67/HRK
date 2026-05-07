"""Customer repository."""

import uuid
from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.customer import Customer


class CustomerRepository:
    """Data access for Customer model."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, customer_id: uuid.UUID) -> Customer | None:
        stmt = (
            select(Customer)
            .options(joinedload(Customer.company))
            .where(Customer.id == customer_id, Customer.deleted_at.is_(None))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list(
        self,
        *,
        q: str | None = None,
        company_id: uuid.UUID | None,
        statuses: list[str] | None,
        created_from: date | None,
        created_to: date | None,
    ) -> list[Customer]:
        stmt = select(Customer).options(joinedload(Customer.company)).where(Customer.deleted_at.is_(None))
        if company_id:
            stmt = stmt.where(Customer.company_id == company_id)
        if q:
            query = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    Customer.ckk.ilike(query),
                    Customer.ckd.ilike(query),
                    Customer.billing_email.ilike(query),
                    Customer.invoice_nip.ilike(query),
                )
            )
        if statuses:
            stmt = stmt.where(Customer.status.in_(statuses))
        if created_from:
            stmt = stmt.where(func.date(Customer.created_at) >= created_from)
        if created_to:
            stmt = stmt.where(func.date(Customer.created_at) <= created_to)
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
