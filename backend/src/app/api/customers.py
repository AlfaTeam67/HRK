"""Customer CRUD API endpoints."""

import uuid
from datetime import date, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import get_crm_service
from app.core.auth import get_current_user
from app.models.enums import CustomerStatus
from app.models.user import User
from app.schemas.customers import CustomerCreate, CustomerRead, CustomerUpdate
from app.schemas.timeline import TimelineEventRead, TimelineEventType
from app.service import CRMService

router = APIRouter(tags=["crm-customers"])


@router.get("/customers", response_model=list[CustomerRead], summary="List customers")
async def list_customers(
    service: Annotated[CRMService, Depends(get_crm_service)],
    _: Annotated[User, Depends(get_current_user)],
    _q: str | None = Query(default=None, alias="q"),
    company_id: uuid.UUID | None = Query(default=None),
    manager_id: uuid.UUID | None = Query(default=None),
    statuses: list[CustomerStatus] | None = Query(default=None),
    created_from: date | None = Query(default=None),
    created_to: date | None = Query(default=None),
) -> Any:
    if manager_id:
        return await service.list_managed_customers(manager_id)
    return await service.list_customers(
        company_id=company_id,
        statuses=[status.value for status in statuses] if statuses else None,
        created_from=created_from,
        created_to=created_to,
    )


@router.post(
    "/customers",
    response_model=CustomerRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create customer",
)
async def create_customer(
    payload: CustomerCreate,
    service: Annotated[CRMService, Depends(get_crm_service)],
    _: Annotated[User, Depends(get_current_user)],
) -> Any:
    return await service.create_customer(payload)


@router.get("/customers/{customer_id}", response_model=CustomerRead, summary="Get customer")
async def get_customer(
    customer_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
    _: Annotated[User, Depends(get_current_user)],
) -> Any:
    return await service.get_customer(customer_id)


@router.patch("/customers/{customer_id}", response_model=CustomerRead, summary="Update customer")
async def update_customer(
    customer_id: uuid.UUID,
    payload: CustomerUpdate,
    service: Annotated[CRMService, Depends(get_crm_service)],
    _: Annotated[User, Depends(get_current_user)],
) -> Any:
    return await service.update_customer(customer_id, payload)


@router.delete(
    "/customers/{customer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete customer",
)
async def delete_customer(
    customer_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
    _: Annotated[User, Depends(get_current_user)],
) -> Response:
    await service.delete_customer(customer_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/customers/{customer_id}/timeline",
    response_model=list[TimelineEventRead],
    summary="Customer timeline",
)
async def get_customer_timeline(
    customer_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
    _: Annotated[User, Depends(get_current_user)],
    from_date: datetime | None = Query(default=None),
    to_date: datetime | None = Query(default=None),
    event_types: list[TimelineEventType] | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
) -> Any:
    await service.get_customer(customer_id)
    return await service.get_customer_timeline(
        customer_id,
        from_date=from_date,
        to_date=to_date,
        event_types=set(event_types) if event_types else None,
        limit=limit,
    )
