"""Service CRUD API endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import get_crm_service
from app.schemas.crm import ServiceCreate, ServiceRead, ServiceUpdate
from app.service.crm import CRMService

router = APIRouter(tags=["crm-services"])


@router.get("/services", response_model=list[ServiceRead], summary="List services")
async def list_services(
    service: Annotated[CRMService, Depends(get_crm_service)],
    company_id: uuid.UUID | None = Query(default=None),
    is_active: bool | None = Query(default=None),
) -> list[ServiceRead]:
    return await service.list_services(company_id=company_id, is_active=is_active)


@router.post(
    "/services",
    response_model=ServiceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create service",
)
async def create_service(
    payload: ServiceCreate,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> ServiceRead:
    return await service.create_service(payload)


@router.get("/services/{service_id}", response_model=ServiceRead, summary="Get service")
async def get_service(
    service_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> ServiceRead:
    return await service.get_service(service_id)


@router.patch("/services/{service_id}", response_model=ServiceRead, summary="Update service")
async def update_service(
    service_id: uuid.UUID,
    payload: ServiceUpdate,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> ServiceRead:
    return await service.update_service(service_id, payload)


@router.delete(
    "/services/{service_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete service",
)
async def delete_service(
    service_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> Response:
    await service.delete_service(service_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
