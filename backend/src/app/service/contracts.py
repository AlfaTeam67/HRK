"""Contract business service."""

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.models.contract import Contract
from app.repo.contracts import ContractRepository
from app.repo.lookups import LookupRepository
from app.schemas.contracts import ContractCreate, ContractUpdate
from app.service.customers import CustomerService


class ContractService:
    """Business operations for contracts."""

    def __init__(
        self,
        contract_repo: ContractRepository,
        lookup_repo: LookupRepository,
        customer_service: CustomerService,
    ) -> None:
        self.contracts = contract_repo
        self.lookup = lookup_repo
        self.customer_service = customer_service

    async def list_contracts(self, **kwargs) -> list[Contract]:
        return await self.contracts.list(**kwargs)

    async def get_contract(self, contract_id: uuid.UUID) -> Contract:
        contract = await self.contracts.get(contract_id)
        if not contract:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
        return contract

    async def create_contract(self, payload: ContractCreate) -> Contract:
        data = payload.model_dump()
        await self._validate_contract_refs(data)
        try:
            return await self.contracts.create(data)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Contract number already exists",
            ) from exc

    async def update_contract(self, contract_id: uuid.UUID, payload: ContractUpdate) -> Contract:
        contract = await self.get_contract(contract_id)
        data = payload.model_dump(exclude_unset=True)
        await self._validate_contract_refs(data)
        if data.get("parent_contract_id") == contract_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Contract cannot reference itself as parent",
            )
        try:
            return await self.contracts.update(contract, data)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Contract update violates unique constraints",
            ) from exc

    async def delete_contract(self, contract_id: uuid.UUID) -> None:
        contract = await self.get_contract(contract_id)
        await self.contracts.update(contract, {"deleted_at": datetime.now(UTC)})

    async def _validate_contract_refs(self, data: dict) -> None:
        customer_id = data.get("customer_id")
        if customer_id:
            await self.customer_service.get_customer(customer_id)

        account_manager_id = data.get("account_manager_id")
        if account_manager_id and not await self.lookup.user_exists(account_manager_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account manager not found",
            )

        parent_contract_id = data.get("parent_contract_id")
        if parent_contract_id:
            parent_contract = await self.contracts.get(parent_contract_id)
            if not parent_contract:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Parent contract not found",
                )
