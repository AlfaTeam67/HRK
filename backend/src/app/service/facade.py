"""Facade service for API workflows."""

import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract import Contract
from app.models.contract_service import ContractService as ContractServiceModel
from app.models.customer import Customer
from app.models.service import Service
from app.models.service_group import ServiceGroup
from app.models.note import Note
from app.models.rate import CustomerRate, Valorization
from app.models.enums import ValorizationStatus

from app.repo.contract_services import ContractServiceRepository
from app.repo.contracts import ContractRepository
from app.repo.customers import CustomerRepository
from app.repo.lookups import LookupRepository
from app.repo.notes import NoteRepository
from app.repo.services import ServiceRepository
from app.repo.service_groups import ServiceGroupRepository
from app.repo.customer_rates import CustomerRateRepository
from app.repo.valorizations import ValorizationRepository

from app.schemas.contract_services import ContractServiceCreate
from app.schemas.contracts import ContractCreate, ContractUpdate
from app.schemas.customers import CustomerCreate, CustomerUpdate
from app.schemas.notes import NoteCreate, NoteUpdate
from app.schemas.services import ServiceCreate, ServiceUpdate
from app.schemas.service_groups import ServiceGroupCreate, ServiceGroupUpdate
from app.schemas.customer_rates import CustomerRateCreate, CustomerRateUpdate
from app.schemas.valorizations import ValorizationCreate, ValorizationUpdate

from app.service.contract_services import ContractServiceRelationService
from app.service.contracts import ContractService
from app.service.customers import CustomerService
from app.service.notes import NoteService
from app.service.services import ServiceCrudService
from app.service.service_groups import ServiceGroupCrudService
from app.service.customer_rates import CustomerRateCrudService
from app.service.valorizations import ValorizationCrudService


class CRMService:
    """Facade exposing operations expected by API layer."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

        customer_repo = CustomerRepository(db)
        contract_repo = ContractRepository(db)
        service_repo = ServiceRepository(db)
        relation_repo = ContractServiceRepository(db)
        lookup_repo = LookupRepository(db)
        group_repo = ServiceGroupRepository(db)
        rate_repo = CustomerRateRepository(db)
        val_repo = ValorizationRepository(db)
        note_repo = NoteRepository(db)

        self.customer_service = CustomerService(customer_repo, lookup_repo)
        self.contract_service = ContractService(contract_repo, lookup_repo, self.customer_service)
        self.service_service = ServiceCrudService(service_repo, lookup_repo)
        self.contract_relation_service = ContractServiceRelationService(
            relation_repo,
            self.contract_service,
            self.service_service,
        )
        self.group_service = ServiceGroupCrudService(group_repo)
        self.rate_service = CustomerRateCrudService(rate_repo)
        self.valorization_service = ValorizationCrudService(val_repo)
        self.note_service = NoteService(note_repo, lookup_repo)

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

    # --- Service Groups ---

    async def list_service_groups(self) -> list[ServiceGroup]:
        return await self.group_service.list_groups()

    async def get_service_group(self, group_id: uuid.UUID) -> ServiceGroup:
        return await self.group_service.get_group(group_id)

    async def create_service_group(self, payload: ServiceGroupCreate) -> ServiceGroup:
        try:
            result = await self.group_service.create_group(payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def update_service_group(self, group_id: uuid.UUID, payload: ServiceGroupUpdate) -> ServiceGroup:
        try:
            result = await self.group_service.update_group(group_id, payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def delete_service_group(self, group_id: uuid.UUID) -> None:
        try:
            await self.group_service.delete_group(group_id)
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise

    # --- Customer Rates ---

    async def list_customer_rates(self) -> list[CustomerRate]:
        return await self.rate_service.list_rates()

    async def get_customer_rate(self, rate_id: uuid.UUID) -> CustomerRate:
        return await self.rate_service.get_rate(rate_id)

    async def create_customer_rate(self, payload: CustomerRateCreate) -> CustomerRate:
        try:
            result = await self.rate_service.create_rate(payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def update_customer_rate(self, rate_id: uuid.UUID, payload: CustomerRateUpdate) -> CustomerRate:
        try:
            result = await self.rate_service.update_rate(rate_id, payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def delete_customer_rate(self, rate_id: uuid.UUID) -> None:
        try:
            await self.rate_service.delete_rate(rate_id)
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise

    # --- Valorizations ---

    async def list_valorizations(
        self,
        contract_id: Optional[uuid.UUID] = None,
        year: Optional[int] = None,
        status_: Optional[ValorizationStatus] = None,
    ) -> list[Valorization]:
        return await self.valorization_service.list_valorizations(contract_id=contract_id, year=year, status_=status_)

    async def get_valorization(self, valorization_id: uuid.UUID) -> Valorization:
        return await self.valorization_service.get_valorization(valorization_id)

    async def create_valorization(self, payload: ValorizationCreate) -> Valorization:
        try:
            result = await self.valorization_service.create_valorization(payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def update_valorization(self, valorization_id: uuid.UUID, payload: ValorizationUpdate) -> Valorization:
        try:
            result = await self.valorization_service.update_valorization(valorization_id, payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def delete_valorization(self, valorization_id: uuid.UUID) -> None:
        try:
            await self.valorization_service.delete_valorization(valorization_id)
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise

    # --- Notes ---

    async def list_notes_by_customer(
        self,
        customer_id: uuid.UUID,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Note]:
        return await self.note_service.list_notes_by_customer(customer_id, skip=skip, limit=limit)

    async def list_notes_by_contract(
        self,
        contract_id: uuid.UUID,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Note]:
        return await self.note_service.list_notes_by_contract(contract_id, skip=skip, limit=limit)

    async def get_note(self, note_id: uuid.UUID) -> Note:
        return await self.note_service.get_note(note_id)

    async def create_note(self, payload: NoteCreate, *, created_by: uuid.UUID | None = None) -> Note:
        try:
            result = await self.note_service.create_note(payload, created_by=created_by)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def update_note(self, note_id: uuid.UUID, payload: NoteUpdate) -> Note:
        try:
            result = await self.note_service.update_note(note_id, payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def delete_note(self, note_id: uuid.UUID) -> None:
        try:
            await self.note_service.delete_note(note_id)
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise
