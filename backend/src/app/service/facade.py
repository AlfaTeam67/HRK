"""Facade service for API workflows."""

import logging
import uuid
from datetime import datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityLog
from app.models.contract import Contract
from app.models.contract_service import ContractService as ContractServiceModel
from app.models.customer import ContactPerson, Customer
from app.models.enums import ValorizationStatus
from app.models.note import Note
from app.models.rate import CustomerRate, Valorization
from app.models.service import Service
from app.models.service_group import ServiceGroup
from app.repo.activity import ActivityLogRepository
from app.repo.contact_persons import ContactPersonRepository
from app.repo.contract_services import ContractServiceRepository
from app.repo.contracts import ContractRepository
from app.repo.customer_rates import CustomerRateRepository
from app.repo.customers import CustomerRepository
from app.repo.lookups import LookupRepository
from app.repo.notes import NoteRepository
from app.repo.service_groups import ServiceGroupRepository
from app.repo.services import ServiceRepository
from app.repo.timeline import TimelineRepository
from app.repo.valorizations import ValorizationRepository
from app.schemas.activity import ActivityLogCreate
from app.schemas.contact_person import ContactPersonCreate, ContactPersonUpdate
from app.schemas.contract_services import ContractServiceCreate
from app.schemas.contracts import ContractCreate, ContractUpdate
from app.schemas.customer_rates import CustomerRateCreate, CustomerRateUpdate
from app.schemas.customers import CustomerCreate, CustomerUpdate
from app.schemas.notes import NoteCreate, NoteUpdate
from app.schemas.service_groups import ServiceGroupCreate, ServiceGroupUpdate
from app.schemas.services import ServiceCreate, ServiceUpdate
from app.schemas.timeline import TimelineEventRead, TimelineEventType
from app.schemas.valorizations import ValorizationCreate, ValorizationUpdate
from app.service.contact_persons import ContactPersonService
from app.service.contract_services import ContractServiceRelationService
from app.service.contracts import ContractCrudService
from app.service.customer_rates import CustomerRateCrudService
from app.service.customers import CustomerService
from app.service.notes import NoteService
from app.service.service_groups import ServiceGroupCrudService
from app.service.services import ServiceCrudService
from app.service.timeline import TimelineService
from app.service.valorizations import ValorizationCrudService

logger = logging.getLogger(__name__)


class CRMService:
    """Facade exposing operations expected by API layer."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

        customer_repo = CustomerRepository(db)
        contract_repo = ContractRepository(db)
        service_repo = ServiceRepository(db)
        relation_repo = ContractServiceRepository(db)
        lookup_repo = LookupRepository(db)
        activity_repo = ActivityLogRepository(db)
        group_repo = ServiceGroupRepository(db)
        rate_repo = CustomerRateRepository(db)
        val_repo = ValorizationRepository(db)
        note_repo = NoteRepository(db)
        contact_person_repo = ContactPersonRepository(db)

        self.customer_service = CustomerService(customer_repo, lookup_repo)
        self.contract_service = ContractCrudService(contract_repo, lookup_repo, self.customer_service)
        self.service_service = ServiceCrudService(service_repo, lookup_repo)
        self.contract_relation_service = ContractServiceRelationService(
            relation_repo,
            self.contract_service,
            self.service_service,
        )
        self.activity_repo = activity_repo
        self.lookup_repo = lookup_repo
        self.group_service = ServiceGroupCrudService(group_repo)
        self.rate_service = CustomerRateCrudService(rate_repo)
        self.valorization_service = ValorizationCrudService(val_repo)
        self.note_service = NoteService(note_repo, lookup_repo)
        self.contact_person_service = ContactPersonService(contact_person_repo, lookup_repo)
        self.timeline_service = TimelineService(TimelineRepository(db))

    async def list_customers(self, **kwargs: Any) -> list[Customer]:
        return await self.customer_service.list_customers(**kwargs)

    async def list_managed_customers(self, manager_id: uuid.UUID) -> list[Customer]:
        return await self.customer_service.list_by_manager(manager_id)

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

    async def list_contracts(self, **kwargs: Any) -> list[Contract]:
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

    async def list_services(self, **kwargs: Any) -> list[Service]:
        return await self.service_service.list_services(**kwargs)

    async def list_activity_logs(
        self,
        *,
        customer_id: uuid.UUID | None,
        contract_id: uuid.UUID | None,
        limit: int,
        offset: int,
    ) -> list[ActivityLog]:
        if customer_id is None and contract_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Either customer_id or contract_id must be provided",
            )
        if customer_id is not None and contract_id is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Only one of customer_id or contract_id can be provided",
            )

        if customer_id is not None:
            await self.customer_service.get_customer(customer_id)
            return await self.activity_repo.get_by_customer(customer_id, limit, offset)

        assert contract_id is not None
        await self.contract_service.get_contract(contract_id)
        return await self.activity_repo.get_by_contract(contract_id, limit, offset)

    async def get_customer_timeline(
        self,
        customer_id: uuid.UUID,
        *,
        from_date: datetime | None,
        to_date: datetime | None,
        event_types: set[TimelineEventType] | None,
        limit: int = 100,
    ) -> list[TimelineEventRead]:
        await self.customer_service.get_customer(customer_id)
        return await self.timeline_service.get_timeline(
            customer_id,
            from_date=from_date,
            to_date=to_date,
            event_types=event_types,
            limit=limit,
        )

    async def create_activity_log(
        self,
        payload: ActivityLogCreate,
        *,
        performed_by: uuid.UUID | None,
    ) -> ActivityLog:
        data = payload.model_dump()
        customer_id = data.get("customer_id")
        contract_id = data.get("contract_id")

        if customer_id is None and contract_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="At least one of customer_id or contract_id must be provided",
            )

        if customer_id is not None:
            await self.customer_service.get_customer(customer_id)

        if contract_id is not None:
            contract = await self.contract_service.get_contract(contract_id)
            if customer_id is not None and contract.customer_id != customer_id:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Provided customer_id does not match contract.customer_id",
                )
            if customer_id is None:
                data["customer_id"] = contract.customer_id

        if performed_by is not None and not await self.lookup_repo.user_exists(performed_by):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        try:
            result = await self.activity_repo.create(data, performed_by=performed_by)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            logger.exception(
                "Failed to create activity log",
                extra={
                    "customer_id": str(data.get("customer_id")),
                    "contract_id": str(data.get("contract_id")),
                    "performed_by": str(performed_by) if performed_by is not None else None,
                },
            )
            raise

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
            result = await self.contract_relation_service.attach_service_to_contract(
                contract_id, payload
            )
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def list_contract_services(self, contract_id: uuid.UUID) -> list[ContractServiceModel]:
        return await self.contract_relation_service.list_contract_services(contract_id)

    async def detach_service_from_contract(
        self, contract_id: uuid.UUID, relation_id: uuid.UUID
    ) -> None:
        try:
            await self.contract_relation_service.detach_service_from_contract(
                contract_id, relation_id
            )
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

    async def update_service_group(
        self, group_id: uuid.UUID, payload: ServiceGroupUpdate
    ) -> ServiceGroup:
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

    async def update_customer_rate(
        self, rate_id: uuid.UUID, payload: CustomerRateUpdate
    ) -> CustomerRate:
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
        contract_id: uuid.UUID | None = None,
        year: int | None = None,
        status_: ValorizationStatus | None = None,
    ) -> list[Valorization]:
        return await self.valorization_service.list_valorizations(
            contract_id=contract_id, year=year, status_=status_
        )

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

    async def update_valorization(
        self, valorization_id: uuid.UUID, payload: ValorizationUpdate
    ) -> Valorization:
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

    async def create_note(
        self, payload: NoteCreate, *, created_by: uuid.UUID | None = None
    ) -> Note:
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

    # --- Contact Persons ---

    async def list_contact_persons(self, customer_id: uuid.UUID) -> list[ContactPerson]:
        return await self.contact_person_service.list_contacts(customer_id)

    async def create_contact_person(self, payload: ContactPersonCreate) -> ContactPerson:
        try:
            result = await self.contact_person_service.create_contact(payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def update_contact_person(
        self,
        customer_id: uuid.UUID,
        contact_id: uuid.UUID,
        payload: ContactPersonUpdate,
    ) -> ContactPerson:
        try:
            result = await self.contact_person_service.update_contact(
                customer_id, contact_id, payload
            )
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def delete_contact_person(self, customer_id: uuid.UUID, contact_id: uuid.UUID) -> None:
        try:
            await self.contact_person_service.delete_contact(customer_id, contact_id)
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise
