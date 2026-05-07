"""Note CRUD API endpoints."""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.api.deps import get_crm_service
from app.core.auth import get_current_user
from app.models.user import User
from app.schemas.notes import NoteCreate, NoteRead, NoteUpdate
from app.service import CRMService

router = APIRouter(prefix="/notes", tags=["crm-notes"])


@router.get("", response_model=list[NoteRead], summary="List notes")
async def list_notes(
    service: Annotated[CRMService, Depends(get_crm_service)],
    _: Annotated[User, Depends(get_current_user)],
    customer_id: uuid.UUID | None = Query(default=None, description="Filter by customer ID"),
    contract_id: uuid.UUID | None = Query(default=None, description="Filter by contract ID"),
    skip: int = Query(default=0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        default=100, ge=1, le=1000, description="Maximum number of records to return"
    ),
) -> Any:
    """List notes, filtered by customer_id or contract_id."""
    if customer_id and contract_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot filter by both customer_id and contract_id simultaneously",
        )

    if customer_id:
        return await service.list_notes_by_customer(customer_id, skip=skip, limit=limit)

    if contract_id:
        return await service.list_notes_by_contract(contract_id, skip=skip, limit=limit)

    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="Either customer_id or contract_id must be provided",
    )


@router.post(
    "",
    response_model=NoteRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create note",
)
async def create_note(
    payload: NoteCreate,
    service: Annotated[CRMService, Depends(get_crm_service)],
    _: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Create a new note."""
    return await service.create_note(payload)


@router.get("/{note_id}", response_model=NoteRead, summary="Get note")
async def get_note(
    note_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
    _: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Get a single note by ID."""
    return await service.get_note(note_id)


@router.patch("/{note_id}", response_model=NoteRead, summary="Update note")
async def update_note(
    note_id: uuid.UUID,
    payload: NoteUpdate,
    service: Annotated[CRMService, Depends(get_crm_service)],
    _: Annotated[User, Depends(get_current_user)],
) -> Any:
    """Update an existing note."""
    return await service.update_note(note_id, payload)


@router.delete(
    "/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete note",
)
async def delete_note(
    note_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
    _: Annotated[User, Depends(get_current_user)],
) -> Response:
    """Soft delete a note."""
    await service.delete_note(note_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
