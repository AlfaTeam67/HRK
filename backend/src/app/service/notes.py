"""Note business service."""

import uuid

from fastapi import HTTPException, status

from app.models.note import Note
from app.repo.lookups import LookupRepository
from app.repo.notes import NoteRepository
from app.schemas.notes import NoteCreate, NoteUpdate


class NoteService:
    """Business operations for notes."""

    def __init__(
        self,
        note_repo: NoteRepository,
        lookup_repo: LookupRepository,
    ) -> None:
        self.notes = note_repo
        self.lookup = lookup_repo

    async def list_notes_by_customer(
        self,
        customer_id: uuid.UUID,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Note]:
        """List notes for a specific customer."""
        return await self.notes.get_multi_by_customer(customer_id, skip=skip, limit=limit)

    async def list_notes_by_contract(
        self,
        contract_id: uuid.UUID,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Note]:
        """List notes for a specific contract."""
        return await self.notes.get_multi_by_contract(contract_id, skip=skip, limit=limit)

    async def get_note(self, note_id: uuid.UUID) -> Note:
        """Get a single note by ID."""
        note = await self.notes.get(note_id)
        if not note:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
        return note

    async def create_note(
        self,
        payload: NoteCreate,
        *,
        created_by: uuid.UUID | None = None,
    ) -> Note:
        """Create a new note."""
        data = payload.model_dump()

        # Validate references exist
        await self._validate_refs(data)

        # Set created_by
        if created_by:
            data["created_by"] = created_by

        return await self.notes.create(data)

    async def update_note(self, note_id: uuid.UUID, payload: NoteUpdate) -> Note:
        """Update an existing note."""
        note = await self.get_note(note_id)
        data = payload.model_dump(exclude_unset=True)
        return await self.notes.update(note, data)

    async def delete_note(self, note_id: uuid.UUID) -> None:
        """Soft delete a note."""
        await self.get_note(note_id)  # Validate note exists
        await self.notes.delete(note_id)

    async def _validate_refs(self, data: dict) -> None:
        """Validate foreign key references."""
        customer_id = data.get("customer_id")
        if customer_id and not await self.lookup.customer_exists(customer_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found",
            )

        contract_id = data.get("contract_id")
        if contract_id and not await self.lookup.contract_exists(contract_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contract not found",
            )
