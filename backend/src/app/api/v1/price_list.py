"""Price list template CRUD endpoints."""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.api.deps import get_crm_service
from app.schemas.price_list import (
    PriceListTemplateCreate,
    PriceListTemplateRead,
    PriceListTemplateUpdate,
)
from app.service import CRMService

router = APIRouter(prefix="/price-list", tags=["price-list"])


@router.get("", response_model=list[PriceListTemplateRead], summary="List price list entries")
async def list_price_list(
    service: Annotated[CRMService, Depends(get_crm_service)],
    active_only: bool = Query(default=False, description="Return only active entries"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=1000),
) -> Any:
    """List all base price entries. Use active_only=true for published prices."""
    return await service.list_price_list(active_only=active_only, skip=skip, limit=limit)


@router.post(
    "",
    response_model=PriceListTemplateRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create price list entry",
)
async def create_price_list_entry(
    payload: PriceListTemplateCreate,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> Any:
    """Create a new base price for a service. One entry per service (unique)."""
    return await service.create_price_list_entry(payload)


@router.get(
    "/{entry_id}",
    response_model=PriceListTemplateRead,
    summary="Get price list entry",
)
async def get_price_list_entry(
    entry_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> Any:
    return await service.get_price_list_entry(entry_id)


@router.patch(
    "/{entry_id}",
    response_model=PriceListTemplateRead,
    summary="Update price list entry",
)
async def update_price_list_entry(
    entry_id: uuid.UUID,
    payload: PriceListTemplateUpdate,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> Any:
    return await service.update_price_list_entry(entry_id, payload)


@router.delete(
    "/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete price list entry",
)
async def delete_price_list_entry(
    entry_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> Response:
    await service.delete_price_list_entry(entry_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
