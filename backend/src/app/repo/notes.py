"""Note repository."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note import Note


class NoteRepository:
    """Data access for Note model."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, note_id: uuid.UUID) -> Note | None:
        """Get a single note by ID, excluding soft-deleted."""
        stmt = select(Note).where(Note.id == note_id, Note.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_multi_by_customer(
        self,
        customer_id: uuid.UUID,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Note]:
        """List notes for a specific customer."""
        stmt = (
            select(Note)
            .where(Note.customer_id == customer_id, Note.deleted_at.is_(None))
            .order_by(Note.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_multi_by_contract(
        self,
        contract_id: uuid.UUID,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Note]:
        """List notes for a specific contract."""
        stmt = (
            select(Note)
            .where(Note.contract_id == contract_id, Note.deleted_at.is_(None))
            .order_by(Note.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, data: dict) -> Note:
        """Create a new note."""
        note = Note(**data)
        self.db.add(note)
        await self.db.flush()
        await self.db.refresh(note)
        return note

    async def update(self, note: Note, data: dict) -> Note:
        """Update an existing note."""
        for key, value in data.items():
            setattr(note, key, value)
        await self.db.flush()
        await self.db.refresh(note)
        return note

    async def delete(self, note_id: uuid.UUID) -> bool:
        """Soft delete a note by ID."""
        from datetime import UTC, datetime

        note = await self.get(note_id)
        if not note:
            return False
        note.deleted_at = datetime.now(UTC)
        await self.db.flush()
        return True
