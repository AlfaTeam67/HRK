"""Contract-service relation business service."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.models.contract_service import ContractService as ContractServiceModel
from app.repo.contract_services import ContractServiceRepository
from app.schemas.contract_services import ContractServiceCreate
from app.service.contracts import ContractCrudService
from app.service.services import ServiceCrudService


class ContractServiceRelationService:
    """Operations for relation between contract and service."""

    def __init__(
        self,
        relation_repo: ContractServiceRepository,
        contract_service: ContractCrudService,
        service_service: ServiceCrudService,
    ) -> None:
        self.contract_services = relation_repo
        self.contract_service = contract_service
        self.service_service = service_service

    async def attach_service_to_contract(
        self,
        contract_id: uuid.UUID,
        payload: ContractServiceCreate,
    ) -> ContractServiceModel:
        await self.contract_service.get_contract(contract_id)
        await self.service_service.get_service(payload.service_id)

        if payload.valid_to and payload.valid_to < payload.valid_from:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="valid_to must be greater than or equal to valid_from",
            )

        data = payload.model_dump()
        data["contract_id"] = contract_id
        try:
            return await self.contract_services.create(data)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Service is already attached for the same validity start date",
            ) from exc

    async def list_contract_services(self, contract_id: uuid.UUID) -> list[ContractServiceModel]:
        await self.contract_service.get_contract(contract_id)
        return await self.contract_services.list_for_contract(contract_id)

    async def detach_service_from_contract(
        self, contract_id: uuid.UUID, relation_id: uuid.UUID
    ) -> None:
        await self.contract_service.get_contract(contract_id)
        relation = await self.contract_services.get_for_contract(
            contract_id=contract_id,
            relation_id=relation_id,
        )
        if not relation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contract service relation not found",
            )
        await self.contract_services.delete(relation)
