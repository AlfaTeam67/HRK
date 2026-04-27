"""CRM CRUD API endpoints."""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.enums import ContractStatus, CustomerStatus
from app.schemas.crm import (
    ContractCreate,
    ContractRead,
    ContractServiceCreate,
    ContractServiceRead,
    ContractUpdate,
    CustomerCreate,
    CustomerRead,
    CustomerUpdate,
    ServiceCreate,
    ServiceRead,
    ServiceUpdate,
)
from app.service.crm import CRMService

router = APIRouter(tags=["crm"])


def get_crm_service(db: Annotated[AsyncSession, Depends(get_db)]) -> CRMService:
    """Provide CRM service instance bound to request DB session."""

    return CRMService(db)


@router.get("/customers", response_model=list[CustomerRead], summary="List customers")
async def list_customers(
    service: Annotated[CRMService, Depends(get_crm_service)],
    company_id: uuid.UUID | None = Query(default=None),
    statuses: list[CustomerStatus] | None = Query(default=None),
    created_from: date | None = Query(default=None),
    created_to: date | None = Query(default=None),
) -> list[CustomerRead]:
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
) -> CustomerRead:
    return await service.create_customer(payload)


@router.get("/customers/{customer_id}", response_model=CustomerRead, summary="Get customer")
async def get_customer(
    customer_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> CustomerRead:
    return await service.get_customer(customer_id)


@router.patch("/customers/{customer_id}", response_model=CustomerRead, summary="Update customer")
async def update_customer(
    customer_id: uuid.UUID,
    payload: CustomerUpdate,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> CustomerRead:
    return await service.update_customer(customer_id, payload)


@router.delete(
    "/customers/{customer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete customer",
)
async def delete_customer(
    customer_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> Response:
    await service.delete_customer(customer_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/contracts", response_model=list[ContractRead], summary="List contracts")
async def list_contracts(
    service: Annotated[CRMService, Depends(get_crm_service)],
    company_id: uuid.UUID | None = Query(default=None),
    statuses: list[ContractStatus] | None = Query(default=None),
    start_from: date | None = Query(default=None),
    start_to: date | None = Query(default=None),
    end_from: date | None = Query(default=None),
    end_to: date | None = Query(default=None),
) -> list[ContractRead]:
    return await service.list_contracts(
        company_id=company_id,
        statuses=[status.value for status in statuses] if statuses else None,
        start_from=start_from,
        start_to=start_to,
        end_from=end_from,
        end_to=end_to,
    )


@router.post(
    "/contracts",
    response_model=ContractRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create contract",
)
async def create_contract(
    payload: ContractCreate,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> ContractRead:
    return await service.create_contract(payload)


@router.get("/contracts/{contract_id}", response_model=ContractRead, summary="Get contract")
async def get_contract(
    contract_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> ContractRead:
    return await service.get_contract(contract_id)


@router.patch("/contracts/{contract_id}", response_model=ContractRead, summary="Update contract")
async def update_contract(
    contract_id: uuid.UUID,
    payload: ContractUpdate,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> ContractRead:
    return await service.update_contract(contract_id, payload)


@router.delete(
    "/contracts/{contract_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete contract",
)
async def delete_contract(
    contract_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> Response:
    await service.delete_contract(contract_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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


@router.get(
    "/contracts/{contract_id}/services",
    response_model=list[ContractServiceRead],
    summary="List services assigned to contract",
)
async def list_contract_services(
    contract_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> list[ContractServiceRead]:
    return await service.list_contract_services(contract_id)


@router.post(
    "/contracts/{contract_id}/services",
    response_model=ContractServiceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Attach service to contract",
)
async def attach_service_to_contract(
    contract_id: uuid.UUID,
    payload: ContractServiceCreate,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> ContractServiceRead:
    return await service.attach_service_to_contract(contract_id, payload)


@router.delete(
    "/contracts/{contract_id}/services/{relation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Detach service from contract",
)
async def detach_service_from_contract(
    contract_id: uuid.UUID,
    relation_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> Response:
    await service.detach_service_from_contract(contract_id, relation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
