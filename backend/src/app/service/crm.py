"""Business services for CRM CRUD operations."""

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract import Contract
from app.models.customer import Customer
from app.models.service import Service
from app.repo.crm import (
    ContractRepository,
    ContractServiceRepository,
    CustomerRepository,
    LookupRepository,
    ServiceRepository,
)
from app.schemas.crm import (
    ContractCreate,
    ContractServiceCreate,
    ContractUpdate,
    CustomerCreate,
    CustomerUpdate,
    ServiceCreate,
    ServiceUpdate,
)


class CRMService:
    """Orchestrates CRM operations and enforces business rules."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.customers = CustomerRepository(db)
        self.contracts = ContractRepository(db)
        self.services = ServiceRepository(db)
        self.contract_services = ContractServiceRepository(db)
        self.lookup = LookupRepository(db)

    async def list_customers(self, **kwargs) -> list[Customer]:
        return await self.customers.list(**kwargs)

    async def get_customer(self, customer_id: uuid.UUID) -> Customer:
        customer = await self.customers.get(customer_id)
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
        return customer

    async def create_customer(self, payload: CustomerCreate) -> Customer:
        data = payload.model_dump()
        await self._validate_customer_refs(data)
        try:
            customer = await self.customers.create(data)
            await self.db.commit()
            return customer
        except IntegrityError as exc:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Customer with provided identifiers already exists",
            ) from exc

    async def update_customer(self, customer_id: uuid.UUID, payload: CustomerUpdate) -> Customer:
        customer = await self.get_customer(customer_id)
        data = payload.model_dump(exclude_unset=True)
        await self._validate_customer_refs(data)
        try:
            customer = await self.customers.update(customer, data)
            await self.db.commit()
            return customer
        except IntegrityError as exc:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Customer update violates unique constraints",
            ) from exc

    async def delete_customer(self, customer_id: uuid.UUID) -> None:
        customer = await self.get_customer(customer_id)
        if await self.lookup.has_customer_contracts(customer_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Customer has active contracts and cannot be deleted",
            )
        customer.deleted_at = datetime.now(UTC)
        await self.db.commit()

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
            contract = await self.contracts.create(data)
            await self.db.commit()
            return contract
        except IntegrityError as exc:
            await self.db.rollback()
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
            contract = await self.contracts.update(contract, data)
            await self.db.commit()
            return contract
        except IntegrityError as exc:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Contract update violates unique constraints",
            ) from exc

    async def delete_contract(self, contract_id: uuid.UUID) -> None:
        contract = await self.get_contract(contract_id)
        contract.deleted_at = datetime.now(UTC)
        await self.db.commit()

    async def list_services(self, **kwargs) -> list[Service]:
        return await self.services.list(**kwargs)

    async def get_service(self, service_id: uuid.UUID) -> Service:
        service = await self.services.get(service_id)
        if not service:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
        return service

    async def create_service(self, payload: ServiceCreate) -> Service:
        data = payload.model_dump()
        await self._validate_service_refs(data)
        try:
            service = await self.services.create(data)
            await self.db.commit()
            return service
        except IntegrityError as exc:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Service create failed due to constraint violation",
            ) from exc

    async def update_service(self, service_id: uuid.UUID, payload: ServiceUpdate) -> Service:
        service = await self.get_service(service_id)
        data = payload.model_dump(exclude_unset=True)
        await self._validate_service_refs(data)
        try:
            service = await self.services.update(service, data)
            await self.db.commit()
            return service
        except IntegrityError as exc:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Service update failed due to constraint violation",
            ) from exc

    async def delete_service(self, service_id: uuid.UUID) -> None:
        service = await self.get_service(service_id)
        service.deleted_at = datetime.now(UTC)
        await self.db.commit()

    async def attach_service_to_contract(
        self,
        contract_id: uuid.UUID,
        payload: ContractServiceCreate,
    ):
        _ = await self.get_contract(contract_id)
        _ = await self.get_service(payload.service_id)

        if payload.valid_to and payload.valid_to < payload.valid_from:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="valid_to must be greater than or equal to valid_from",
            )

        data = payload.model_dump()
        data["contract_id"] = contract_id
        try:
            relation = await self.contract_services.create(data)
            await self.db.commit()
            return relation
        except IntegrityError as exc:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Service is already attached for the same validity start date",
            ) from exc

    async def list_contract_services(self, contract_id: uuid.UUID):
        _ = await self.get_contract(contract_id)
        return await self.contract_services.list_for_contract(contract_id)

    async def detach_service_from_contract(self, contract_id: uuid.UUID, relation_id: uuid.UUID) -> None:
        _ = await self.get_contract(contract_id)
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
        await self.db.commit()

    async def _validate_customer_refs(self, data: dict) -> None:
        company_id = data.get("company_id")
        if company_id and not await self.lookup.company_exists(company_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company not found",
            )

        account_manager_id = data.get("account_manager_id")
        if account_manager_id and not await self.lookup.user_exists(account_manager_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account manager not found",
            )

    async def _validate_contract_refs(self, data: dict) -> None:
        customer_id = data.get("customer_id")
        if customer_id:
            await self.get_customer(customer_id)

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

    async def _validate_service_refs(self, data: dict) -> None:
        group_id = data.get("group_id")
        if group_id and not await self.lookup.service_group_exists(group_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service group not found",
            )
