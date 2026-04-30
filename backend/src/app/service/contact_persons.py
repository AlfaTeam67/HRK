"""ContactPerson business service."""

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.models.customer import ContactPerson
from app.repo.contact_persons import ContactPersonRepository
from app.repo.lookups import LookupRepository
from app.schemas.contact_person import ContactPersonCreate, ContactPersonUpdate


class ContactPersonService:
    """Business operations for ContactPerson."""

    def __init__(
        self,
        contact_repo: ContactPersonRepository,
        lookup_repo: LookupRepository,
    ) -> None:
        self.contacts = contact_repo
        self.lookup = lookup_repo

    async def list_contacts(self, customer_id: uuid.UUID) -> list[ContactPerson]:
        """List all contacts for a customer."""
        # Verify customer exists
        if not await self.lookup.customer_exists(customer_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found",
            )
        return await self.contacts.list_by_customer(customer_id)

    async def get_contact(self, contact_id: uuid.UUID) -> ContactPerson:
        """Get a single contact by ID."""
        contact = await self.contacts.get(contact_id)
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contact person not found",
            )
        return contact

    async def create_contact(self, payload: ContactPersonCreate) -> ContactPerson:
        """Create a new contact person for a customer."""
        # Verify customer exists
        if not await self.lookup.customer_exists(payload.customer_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found",
            )

        data = payload.model_dump()
        try:
            return await self.contacts.create(data)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Contact person create failed due to constraint violation",
            ) from exc

    async def update_contact(
        self,
        customer_id: uuid.UUID,
        contact_id: uuid.UUID,
        payload: ContactPersonUpdate,
    ) -> ContactPerson:
        """Update an existing contact person."""
        contact = await self.get_contact(contact_id)
        if contact.customer_id != customer_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contact person not found",
            )
        data = payload.model_dump(exclude_unset=True)

        # Remove customer_id if present - can't change customer
        if "customer_id" in data:
            del data["customer_id"]

        try:
            return await self.contacts.update(contact, data)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Contact person update failed due to constraint violation",
            ) from exc

    async def delete_contact(self, customer_id: uuid.UUID, contact_id: uuid.UUID) -> None:
        """Soft delete a contact person."""
        contact = await self.get_contact(contact_id)
        if contact.customer_id != customer_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contact person not found",
            )
        await self.contacts.delete(contact)
