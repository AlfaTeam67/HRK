"""ServiceGroup API endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.deps import get_crm_service
from app.schemas.service_groups import ServiceGroupCreate, ServiceGroupRead, ServiceGroupUpdate
from app.service import CRMService

router = APIRouter(tags=["service-groups"])


@router.get("/service-groups", response_model=list[ServiceGroupRead], summary="List service groups")
async def list_service_groups(
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> list[ServiceGroupRead]:
    return await service.list_service_groups()


@router.post(
    "/service-groups",
    response_model=ServiceGroupRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create service group",
)
async def create_service_group(
    payload: ServiceGroupCreate,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> ServiceGroupRead:
    return await service.create_service_group(payload)


@router.get("/service-groups/{group_id}", response_model=ServiceGroupRead, summary="Get service group")
async def get_service_group(
    group_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> ServiceGroupRead:
    return await service.get_service_group(group_id)


@router.patch("/service-groups/{group_id}", response_model=ServiceGroupRead, summary="Update service group")
async def update_service_group(
    group_id: uuid.UUID,
    payload: ServiceGroupUpdate,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> ServiceGroupRead:
    return await service.update_service_group(group_id, payload)


@router.delete("/service-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete service group")
async def delete_service_group(
    group_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> None:
    await service.delete_service_group(group_id)
