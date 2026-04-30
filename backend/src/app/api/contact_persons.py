"""ContactPerson CRUD API endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from app.api.deps import get_crm_service
from app.schemas.contact_person import (
    ContactPersonCreate,
    ContactPersonRead,
    ContactPersonUpdate,
)
from app.service import CRMService

router = APIRouter(tags=["contact-persons"])


@router.get(
    "/customers/{customer_id}/contacts",
    response_model=list[ContactPersonRead],
    summary="List contact persons for a customer",
)
async def list_contact_persons(
    customer_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> list[ContactPersonRead]:
    """Get all contact persons for a specific customer."""
    return await service.list_contact_persons(customer_id)


@router.post(
    "/customers/{customer_id}/contacts",
    response_model=ContactPersonRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add contact person to customer",
)
async def create_contact_person(
    customer_id: uuid.UUID,
    payload: ContactPersonCreate,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> ContactPersonRead:
    """Add a new contact person to a customer."""
    # Ensure customer_id in path matches payload
    if payload.customer_id != customer_id:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="customer_id in path must match payload",
        )
    return await service.create_contact_person(payload)


@router.patch(
    "/customers/{customer_id}/contacts/{contact_id}",
    response_model=ContactPersonRead,
    summary="Update contact person",
)
async def update_contact_person(
    customer_id: uuid.UUID,
    contact_id: uuid.UUID,
    payload: ContactPersonUpdate,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> ContactPersonRead:
    """Update an existing contact person."""
    return await service.update_contact_person(customer_id, contact_id, payload)


@router.delete(
    "/customers/{customer_id}/contacts/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete contact person",
)
async def delete_contact_person(
    customer_id: uuid.UUID,
    contact_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> Response:
    """Soft delete a contact person."""
    await service.delete_contact_person(customer_id, contact_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
