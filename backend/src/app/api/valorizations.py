"""Valorization API endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_crm_service
from app.core.auth import get_current_user
from app.models.enums import ValorizationStatus
from app.models.user import User
from app.schemas.valorizations import ValorizationCreate, ValorizationRead, ValorizationUpdate
from app.service import CRMService

router = APIRouter(tags=["valorizations"])


@router.get("/valorizations", response_model=list[ValorizationRead], summary="List valorizations")
async def list_valorizations(
    service: Annotated[CRMService, Depends(get_crm_service)],
    _: Annotated[User, Depends(get_current_user)],
    contract_id: uuid.UUID | None = Query(default=None),
    year: int | None = Query(default=None),
    status_: ValorizationStatus | None = Query(default=None, alias="status"),
) -> list[ValorizationRead]:
    return await service.list_valorizations(
        contract_id=contract_id,
        year=year,
        status_=status_,
    )


@router.post(
    "/valorizations",
    response_model=ValorizationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create valorization",
)
async def create_valorization(
    payload: ValorizationCreate,
    service: Annotated[CRMService, Depends(get_crm_service)],
    _: Annotated[User, Depends(get_current_user)],
) -> ValorizationRead:
    return await service.create_valorization(payload)


@router.get(
    "/valorizations/{valorization_id}", response_model=ValorizationRead, summary="Get valorization"
)
async def get_valorization(
    valorization_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
    _: Annotated[User, Depends(get_current_user)],
) -> ValorizationRead:
    return await service.get_valorization(valorization_id)


@router.patch(
    "/valorizations/{valorization_id}",
    response_model=ValorizationRead,
    summary="Update valorization",
)
async def update_valorization(
    valorization_id: uuid.UUID,
    payload: ValorizationUpdate,
    service: Annotated[CRMService, Depends(get_crm_service)],
    _: Annotated[User, Depends(get_current_user)],
) -> ValorizationRead:
    return await service.update_valorization(valorization_id, payload)


@router.delete(
    "/valorizations/{valorization_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete valorization",
)
async def delete_valorization(
    valorization_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
    _: Annotated[User, Depends(get_current_user)],
) -> None:
    await service.delete_valorization(valorization_id)
