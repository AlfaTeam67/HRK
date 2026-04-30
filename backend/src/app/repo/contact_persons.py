"""ContactPerson repository."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import ContactPerson


class ContactPersonRepository:
    """Data access for ContactPerson model."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, contact_id: uuid.UUID) -> ContactPerson | None:
        stmt = select(ContactPerson).where(
            ContactPerson.id == contact_id,
            ContactPerson.deleted_at.is_(None),
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_customer(self, customer_id: uuid.UUID) -> list[ContactPerson]:
        stmt = (
            select(ContactPerson)
            .where(
                ContactPerson.customer_id == customer_id,
                ContactPerson.deleted_at.is_(None),
            )
            .order_by(ContactPerson.is_primary.desc(), ContactPerson.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, data: dict) -> ContactPerson:
        contact = ContactPerson(**data)
        self.db.add(contact)
        await self.db.flush()
        await self.db.refresh(contact)
        return contact

    async def update(self, contact: ContactPerson, data: dict) -> ContactPerson:
        for key, value in data.items():
            if value is not None:
                setattr(contact, key, value)
        await self.db.flush()
        await self.db.refresh(contact)
        return contact

    async def delete(self, contact: ContactPerson) -> None:
        """Soft delete contact person."""
        from datetime import datetime, timezone

        contact.deleted_at = datetime.now(timezone.utc)
        await self.db.flush()
