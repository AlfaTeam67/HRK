"""CustomerRate API endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.deps import get_crm_service
from app.schemas.customer_rates import CustomerRateCreate, CustomerRateRead, CustomerRateUpdate
from app.service import CRMService

router = APIRouter(tags=["customer-rates"])


@router.get("/customer-rates", response_model=list[CustomerRateRead], summary="List customer rates")
async def list_customer_rates(
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> list[CustomerRateRead]:
    return await service.list_customer_rates()


@router.post(
    "/customer-rates",
    response_model=CustomerRateRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create customer rate",
)
async def create_customer_rate(
    payload: CustomerRateCreate,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> CustomerRateRead:
    return await service.create_customer_rate(payload)


@router.get(
    "/customer-rates/{rate_id}", response_model=CustomerRateRead, summary="Get customer rate"
)
async def get_customer_rate(
    rate_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> CustomerRateRead:
    return await service.get_customer_rate(rate_id)


@router.patch(
    "/customer-rates/{rate_id}", response_model=CustomerRateRead, summary="Update customer rate"
)
async def update_customer_rate(
    rate_id: uuid.UUID,
    payload: CustomerRateUpdate,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> CustomerRateRead:
    return await service.update_customer_rate(rate_id, payload)


@router.delete(
    "/customer-rates/{rate_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete customer rate",
)
async def delete_customer_rate(
    rate_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> None:
    await service.delete_customer_rate(rate_id)
