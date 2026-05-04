"""Contract CRUD API endpoints."""

import uuid
from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import get_crm_service
from app.models.enums import ContractStatus
from app.schemas.contract_services import ContractServiceCreate, ContractServiceRead
from app.schemas.contracts import (
    ContractCreate,
    ContractRead,
    ContractUpdate,
)
from app.service import CRMService

router = APIRouter(tags=["crm-contracts"])


@router.get("/contracts", response_model=list[ContractRead], summary="List contracts")
async def list_contracts(
    service: Annotated[CRMService, Depends(get_crm_service)],
    company_id: uuid.UUID | None = Query(default=None),
    customer_id: uuid.UUID | None = Query(default=None),
    statuses: list[ContractStatus] | None = Query(default=None),
    start_from: date | None = Query(default=None),
    start_to: date | None = Query(default=None),
    end_from: date | None = Query(default=None),
    end_to: date | None = Query(default=None),
) -> Any:
    return await service.list_contracts(
        company_id=company_id,
        customer_id=customer_id,
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
) -> Any:
    return await service.create_contract(payload)


@router.get("/contracts/{contract_id}", response_model=ContractRead, summary="Get contract")
async def get_contract(
    contract_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> Any:
    return await service.get_contract(contract_id)


@router.patch("/contracts/{contract_id}", response_model=ContractRead, summary="Update contract")
async def update_contract(
    contract_id: uuid.UUID,
    payload: ContractUpdate,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> Any:
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


@router.get(
    "/contracts/{contract_id}/services",
    response_model=list[ContractServiceRead],
    summary="List services assigned to contract",
)
async def list_contract_services(
    contract_id: uuid.UUID,
    service: Annotated[CRMService, Depends(get_crm_service)],
) -> Any:
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
) -> Any:
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
