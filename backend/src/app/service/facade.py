"""Facade service for API workflows."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract import Contract
from app.models.contract_service import ContractService as ContractServiceModel
from app.models.customer import Customer
from app.models.service import Service
from app.repo.contract_services import ContractServiceRepository
from app.repo.contracts import ContractRepository
from app.repo.customers import CustomerRepository
from app.repo.lookups import LookupRepository
from app.repo.services import ServiceRepository
from app.schemas.contract_services import ContractServiceCreate
from app.schemas.contracts import ContractCreate, ContractUpdate
from app.schemas.customers import CustomerCreate, CustomerUpdate
from app.schemas.services import ServiceCreate, ServiceUpdate
from app.service.contract_services import ContractServiceRelationService
from app.service.contracts import ContractService
from app.service.customers import CustomerService
from app.service.services import ServiceCrudService


class CRMService:
    """Facade exposing operations expected by API layer."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

        customer_repo = CustomerRepository(db)
        contract_repo = ContractRepository(db)
        service_repo = ServiceRepository(db)
        relation_repo = ContractServiceRepository(db)
        lookup_repo = LookupRepository(db)

        self.customer_service = CustomerService(customer_repo, lookup_repo)
        self.contract_service = ContractService(contract_repo, lookup_repo, self.customer_service)
        self.service_service = ServiceCrudService(service_repo, lookup_repo)
        self.contract_relation_service = ContractServiceRelationService(
            relation_repo,
            self.contract_service,
            self.service_service,
        )

    async def list_customers(self, **kwargs) -> list[Customer]:
        return await self.customer_service.list_customers(**kwargs)

    async def get_customer(self, customer_id: uuid.UUID) -> Customer:
        return await self.customer_service.get_customer(customer_id)

    async def create_customer(self, payload: CustomerCreate) -> Customer:
        try:
            result = await self.customer_service.create_customer(payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def update_customer(self, customer_id: uuid.UUID, payload: CustomerUpdate) -> Customer:
        try:
            result = await self.customer_service.update_customer(customer_id, payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def delete_customer(self, customer_id: uuid.UUID) -> None:
        try:
            await self.customer_service.delete_customer(customer_id)
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise

    async def list_contracts(self, **kwargs) -> list[Contract]:
        return await self.contract_service.list_contracts(**kwargs)

    async def get_contract(self, contract_id: uuid.UUID) -> Contract:
        return await self.contract_service.get_contract(contract_id)

    async def create_contract(self, payload: ContractCreate) -> Contract:
        try:
            result = await self.contract_service.create_contract(payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def update_contract(self, contract_id: uuid.UUID, payload: ContractUpdate) -> Contract:
        try:
            result = await self.contract_service.update_contract(contract_id, payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def delete_contract(self, contract_id: uuid.UUID) -> None:
        try:
            await self.contract_service.delete_contract(contract_id)
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise

    async def list_services(self, **kwargs) -> list[Service]:
        return await self.service_service.list_services(**kwargs)

    async def get_service(self, service_id: uuid.UUID) -> Service:
        return await self.service_service.get_service(service_id)

    async def create_service(self, payload: ServiceCreate) -> Service:
        try:
            result = await self.service_service.create_service(payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def update_service(self, service_id: uuid.UUID, payload: ServiceUpdate) -> Service:
        try:
            result = await self.service_service.update_service(service_id, payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def delete_service(self, service_id: uuid.UUID) -> None:
        try:
            await self.service_service.delete_service(service_id)
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise

    async def attach_service_to_contract(
        self,
        contract_id: uuid.UUID,
        payload: ContractServiceCreate,
    ) -> ContractServiceModel:
        try:
            result = await self.contract_relation_service.attach_service_to_contract(contract_id, payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def list_contract_services(self, contract_id: uuid.UUID) -> list[ContractServiceModel]:
        return await self.contract_relation_service.list_contract_services(contract_id)

    async def detach_service_from_contract(self, contract_id: uuid.UUID, relation_id: uuid.UUID) -> None:
        try:
            await self.contract_relation_service.detach_service_from_contract(contract_id, relation_id)
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise
