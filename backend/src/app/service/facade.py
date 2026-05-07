"""Facade service for API workflows."""

import logging
import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import AuthorizationService
from app.models.activity import ActivityLog
from app.models.contract import Contract
from app.models.contract_service import ContractService as ContractServiceModel
from app.models.customer import ContactPerson, Customer
from app.models.enums import UserRole, ValorizationStatus
from app.models.note import Note
from app.models.rate import CustomerRate, Valorization
from app.models.service import Service
from app.models.service_group import ServiceGroup
from app.models.user import User
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


class _ScopeContext:
    def __init__(
        self,
        *,
        is_admin: bool,
        company_ids: set[uuid.UUID],
        contract_ids: set[uuid.UUID],
    ) -> None:
        self.is_admin = is_admin
        self.company_ids = company_ids
        self.contract_ids = contract_ids


class CRMService:
    """Facade exposing operations expected by API layer."""

    def __init__(self, db: AsyncSession, *, current_user: User) -> None:
        self.db = db
        self.current_user = current_user
        self.authorization = AuthorizationService(db)

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

    async def list_customers(self, **kwargs: object) -> list[Customer]:
        await self._authorize_company_filter(resource="customer", action="list", **kwargs)
        scope = await self._get_user_scope()
        company_id = kwargs.get("company_id")
        if scope.is_admin:
            return await self.customer_service.list_customers(**kwargs)

        allowed_company_ids = await self._resolve_allowed_company_ids(scope)
        if company_id:
            if company_id not in allowed_company_ids:
                return []
            return await self.customer_service.list_customers(**kwargs)

        if not allowed_company_ids:
            return []

        items = await self.customer_service.list_customers(**kwargs)
        return [item for item in items if item.company_id in allowed_company_ids]

    async def list_managed_customers(self, manager_id: uuid.UUID) -> list[Customer]:
        return await self.customer_service.list_by_manager(manager_id)

    async def get_customer(self, customer_id: uuid.UUID) -> Customer:
        customer = await self.customer_service.get_customer(customer_id)
        await self._authorize_company_resource(
            resource="customer",
            action="read",
            company_id=customer.company_id,
        )
        return customer

    async def get_customer_timeline(
        self,
        customer_id: uuid.UUID,
        *,
        from_date: datetime | None,
        to_date: datetime | None,
        event_types: set[TimelineEventType] | None,
        limit: int = 100,
    ) -> list[TimelineEventRead]:
        await self.get_customer(customer_id)
        return await self.timeline_service.get_timeline(
            customer_id,
            from_date=from_date,
            to_date=to_date,
            event_types=event_types,
            limit=limit,
        )

    async def create_customer(self, payload: CustomerCreate) -> Customer:
        try:
            await self._authorize_company_resource(
                resource="customer",
                action="create",
                company_id=payload.company_id,
            )
            result = await self.customer_service.create_customer(payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def update_customer(self, customer_id: uuid.UUID, payload: CustomerUpdate) -> Customer:
        try:
            existing = await self.customer_service.get_customer(customer_id)
            await self._authorize_company_resource(
                resource="customer",
                action="update",
                company_id=existing.company_id,
            )
            result = await self.customer_service.update_customer(customer_id, payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def delete_customer(self, customer_id: uuid.UUID) -> None:
        try:
            customer = await self.customer_service.get_customer(customer_id)
            await self._authorize_company_resource(
                resource="customer",
                action="delete",
                company_id=customer.company_id,
            )
            await self.customer_service.delete_customer(customer_id)
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise

    async def list_contracts(self, **kwargs: object) -> list[Contract]:
        await self._authorize_company_filter(resource="contract", action="list", **kwargs)
        scope = await self._get_user_scope()
        company_id = kwargs.get("company_id")
        if scope.is_admin:
            return await self.contract_service.list_contracts(**kwargs)

        allowed_company_ids = await self._resolve_allowed_company_ids(scope)
        allowed_contract_ids = scope.contract_ids
        if company_id:
            if company_id not in allowed_company_ids:
                return []
            return await self.contract_service.list_contracts(**kwargs)

        if not allowed_company_ids and not allowed_contract_ids:
            return []

        items = await self.contract_service.list_contracts(**kwargs)
        customer_ids = {contract.customer_id for contract in items}
        company_map = await self._get_company_ids_for_customers(customer_ids)
        filtered: list[Contract] = []
        for contract in items:
            if contract.id in allowed_contract_ids:
                filtered.append(contract)
                continue
            company_id_for_contract = company_map.get(contract.customer_id)
            if company_id_for_contract in allowed_company_ids:
                filtered.append(contract)
        return filtered

    async def get_contract(self, contract_id: uuid.UUID) -> Contract:
        contract = await self.contract_service.get_contract(contract_id)
        company_id = await self._resolve_company_id_from_contract(contract)
        await self._authorize_company_resource(
            resource="contract",
            action="read",
            company_id=company_id,
            contract_id=contract.id,
        )
        return contract

    async def create_contract(self, payload: ContractCreate) -> Contract:
        try:
            customer = await self.customer_service.get_customer(payload.customer_id)
            await self._authorize_company_resource(
                resource="contract",
                action="create",
                company_id=customer.company_id,
                contract_id=None,
            )
            result = await self.contract_service.create_contract(payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def update_contract(self, contract_id: uuid.UUID, payload: ContractUpdate) -> Contract:
        try:
            existing = await self.contract_service.get_contract(contract_id)
            company_id = await self._resolve_company_id_from_contract(existing)
            await self._authorize_company_resource(
                resource="contract",
                action="update",
                company_id=company_id,
                contract_id=existing.id,
            )
            result = await self.contract_service.update_contract(contract_id, payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def delete_contract(self, contract_id: uuid.UUID) -> None:
        try:
            contract = await self.contract_service.get_contract(contract_id)
            company_id = await self._resolve_company_id_from_contract(contract)
            await self._authorize_company_resource(
                resource="contract",
                action="delete",
                company_id=company_id,
                contract_id=contract.id,
            )
            await self.contract_service.delete_contract(contract_id)
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise

    async def list_services(self, **kwargs: object) -> list[Service]:
        await self._authorize_company_filter(resource="service", action="list", **kwargs)
        scope = await self._get_user_scope()
        company_id = kwargs.get("company_id")
        if scope.is_admin:
            return await self.service_service.list_services(**kwargs)

        allowed_company_ids = await self._resolve_allowed_company_ids(scope)
        if company_id:
            if company_id not in allowed_company_ids:
                return []
            return await self.service_service.list_services(**kwargs)

        if not allowed_company_ids:
            return []

        is_active = kwargs.get("is_active")
        combined: list[Service] = []
        seen: set[uuid.UUID] = set()
        for allowed_company_id in allowed_company_ids:
            items = await self.service_service.list_services(
                company_id=allowed_company_id,
                is_active=is_active,
            )
            for item in items:
                if item.id not in seen:
                    seen.add(item.id)
                    combined.append(item)
        return combined

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
            customer = await self.customer_service.get_customer(customer_id)
            await self._authorize_company_resource(
                resource="activity",
                action="list",
                company_id=customer.company_id,
            )
            return await self.activity_repo.get_by_customer(customer_id, limit, offset)

        assert contract_id is not None  # nosec B101
        contract = await self.contract_service.get_contract(contract_id)
        company_id = await self._resolve_company_id_from_contract(contract)
        await self._authorize_company_resource(
            resource="activity",
            action="list",
            company_id=company_id,
            contract_id=contract.id,
        )
        return await self.activity_repo.get_by_contract(contract_id, limit, offset)

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
            customer = await self.customer_service.get_customer(customer_id)
            await self._authorize_company_resource(
                resource="activity",
                action="create",
                company_id=customer.company_id,
            )

        if contract_id is not None:
            contract = await self.contract_service.get_contract(contract_id)
            company_id = await self._resolve_company_id_from_contract(contract)
            await self._authorize_company_resource(
                resource="activity",
                action="create",
                company_id=company_id,
                contract_id=contract.id,
            )
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
        service = await self.service_service.get_service(service_id)
        await self._authorize_service_scope(service_id)
        return service

    async def create_service(self, payload: ServiceCreate) -> Service:
        try:
            await self._authorize_role_only(resource="service", action="create")
            result = await self.service_service.create_service(payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def update_service(self, service_id: uuid.UUID, payload: ServiceUpdate) -> Service:
        try:
            await self._authorize_role_only(resource="service", action="update")
            result = await self.service_service.update_service(service_id, payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def delete_service(self, service_id: uuid.UUID) -> None:
        try:
            await self._authorize_role_only(resource="service", action="delete")
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
            contract = await self.contract_service.get_contract(contract_id)
            company_id = await self._resolve_company_id_from_contract(contract)
            await self._authorize_company_resource(
                resource="contract",
                action="update",
                company_id=company_id,
                contract_id=contract.id,
            )
            result = await self.contract_relation_service.attach_service_to_contract(
                contract_id, payload
            )
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def list_contract_services(self, contract_id: uuid.UUID) -> list[ContractServiceModel]:
        contract = await self.contract_service.get_contract(contract_id)
        company_id = await self._resolve_company_id_from_contract(contract)
        await self._authorize_company_resource(
            resource="contract",
            action="read",
            company_id=company_id,
            contract_id=contract.id,
        )
        return await self.contract_relation_service.list_contract_services(contract_id)

    async def detach_service_from_contract(
        self, contract_id: uuid.UUID, relation_id: uuid.UUID
    ) -> None:
        try:
            contract = await self.contract_service.get_contract(contract_id)
            company_id = await self._resolve_company_id_from_contract(contract)
            await self._authorize_company_resource(
                resource="contract",
                action="update",
                company_id=company_id,
                contract_id=contract.id,
            )
            await self.contract_relation_service.detach_service_from_contract(
                contract_id, relation_id
            )
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise

    # --- Service Groups ---

    async def list_service_groups(self) -> list[ServiceGroup]:
        await self._authorize_role_only(resource="service", action="list")
        return await self.group_service.list_groups()

    async def get_service_group(self, group_id: uuid.UUID) -> ServiceGroup:
        await self._authorize_role_only(resource="service", action="read")
        return await self.group_service.get_group(group_id)

    async def create_service_group(self, payload: ServiceGroupCreate) -> ServiceGroup:
        try:
            await self._authorize_role_only(resource="service", action="create")
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
            await self._authorize_role_only(resource="service", action="update")
            result = await self.group_service.update_group(group_id, payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def delete_service_group(self, group_id: uuid.UUID) -> None:
        try:
            await self._authorize_role_only(resource="service", action="delete")
            await self.group_service.delete_group(group_id)
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise

    # --- Customer Rates ---

    async def list_customer_rates(self) -> list[CustomerRate]:
        await self._authorize_role_only(resource="rate", action="list")
        scope = await self._get_user_scope()
        if scope.is_admin:
            return await self.rate_service.list_rates()

        allowed_company_ids = await self._resolve_allowed_company_ids(scope)
        allowed_contract_ids = scope.contract_ids
        if not allowed_company_ids and not allowed_contract_ids:
            return []

        items = await self.rate_service.list_rates()
        filtered: list[CustomerRate] = []
        for rate in items:
            contract_id = await self._resolve_contract_id_from_rate(rate)
            if contract_id is None:
                continue
            if contract_id in allowed_contract_ids:
                filtered.append(rate)
                continue
            company_id = await self._resolve_company_id_from_contract_id(contract_id)
            if company_id in allowed_company_ids:
                filtered.append(rate)
        return filtered

    async def get_customer_rate(self, rate_id: uuid.UUID) -> CustomerRate:
        rate = await self.rate_service.get_rate(rate_id)
        contract_id = await self._resolve_contract_id_from_rate(rate)
        if contract_id is None:
            return rate
        await self._authorize_contract_resource(
            resource="rate",
            action="read",
            contract_id=contract_id,
        )
        return rate

    async def create_customer_rate(self, payload: CustomerRateCreate) -> CustomerRate:
        try:
            contract_id = await self._resolve_contract_id_from_contract_service_id(
                payload.contract_service_id
            )
            if contract_id is not None:
                await self._authorize_contract_resource(
                    resource="rate",
                    action="create",
                    contract_id=contract_id,
                )
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
            existing = await self.rate_service.get_rate(rate_id)
            contract_id = await self._resolve_contract_id_from_rate(existing)
            if contract_id is not None:
                await self._authorize_contract_resource(
                    resource="rate",
                    action="update",
                    contract_id=contract_id,
                )
            result = await self.rate_service.update_rate(rate_id, payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def delete_customer_rate(self, rate_id: uuid.UUID) -> None:
        try:
            existing = await self.rate_service.get_rate(rate_id)
            contract_id = await self._resolve_contract_id_from_rate(existing)
            if contract_id is not None:
                await self._authorize_contract_resource(
                    resource="rate",
                    action="delete",
                    contract_id=contract_id,
                )
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
        await self._authorize_contract_filter(
            resource="valorization",
            action="list",
            contract_id=contract_id,
        )
        items = await self.valorization_service.list_valorizations(
            contract_id=contract_id, year=year, status_=status_
        )
        scope = await self._get_user_scope()
        if scope.is_admin or contract_id is not None:
            return items

        allowed_company_ids = await self._resolve_allowed_company_ids(scope)
        allowed_contract_ids = scope.contract_ids
        if not allowed_company_ids and not allowed_contract_ids:
            return []

        filtered: list[Valorization] = []
        for val in items:
            if val.contract_id in allowed_contract_ids:
                filtered.append(val)
                continue
            company_id = await self._resolve_company_id_from_contract_id(val.contract_id)
            if company_id in allowed_company_ids:
                filtered.append(val)
        return filtered

    async def get_valorization(self, valorization_id: uuid.UUID) -> Valorization:
        val = await self.valorization_service.get_valorization(valorization_id)
        await self._authorize_contract_resource(
            resource="valorization",
            action="read",
            contract_id=val.contract_id,
        )
        return val

    async def create_valorization(self, payload: ValorizationCreate) -> Valorization:
        try:
            await self._authorize_contract_resource(
                resource="valorization",
                action="create",
                contract_id=payload.contract_id,
            )
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
            existing = await self.valorization_service.get_valorization(valorization_id)
            await self._authorize_contract_resource(
                resource="valorization",
                action="update",
                contract_id=existing.contract_id,
            )
            result = await self.valorization_service.update_valorization(valorization_id, payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def delete_valorization(self, valorization_id: uuid.UUID) -> None:
        try:
            existing = await self.valorization_service.get_valorization(valorization_id)
            await self._authorize_contract_resource(
                resource="valorization",
                action="delete",
                contract_id=existing.contract_id,
            )
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
        customer = await self.customer_service.get_customer(customer_id)
        await self._authorize_company_resource(
            resource="note",
            action="list",
            company_id=customer.company_id,
        )
        return await self.note_service.list_notes_by_customer(customer_id, skip=skip, limit=limit)

    async def list_notes_by_contract(
        self,
        contract_id: uuid.UUID,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Note]:
        contract = await self.contract_service.get_contract(contract_id)
        company_id = await self._resolve_company_id_from_contract(contract)
        await self._authorize_company_resource(
            resource="note",
            action="list",
            company_id=company_id,
            contract_id=contract.id,
        )
        return await self.note_service.list_notes_by_contract(contract_id, skip=skip, limit=limit)

    async def get_note(self, note_id: uuid.UUID) -> Note:
        note = await self.note_service.get_note(note_id)
        company_id = await self._resolve_company_id_from_note(note)
        await self._authorize_company_resource(
            resource="note",
            action="read",
            company_id=company_id,
            contract_id=note.contract_id,
        )
        return note

    async def create_note(
        self, payload: NoteCreate, *, created_by: uuid.UUID | None = None
    ) -> Note:
        try:
            if created_by is None:
                created_by = self.current_user.id
            company_id, contract_id = await self._resolve_company_and_contract_from_note_payload(
                payload
            )
            await self._authorize_company_resource(
                resource="note",
                action="create",
                company_id=company_id,
                contract_id=contract_id,
            )
            result = await self.note_service.create_note(payload, created_by=created_by)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def update_note(self, note_id: uuid.UUID, payload: NoteUpdate) -> Note:
        try:
            existing = await self.note_service.get_note(note_id)
            company_id = await self._resolve_company_id_from_note(existing)
            await self._authorize_company_resource(
                resource="note",
                action="update",
                company_id=company_id,
                contract_id=existing.contract_id,
            )
            result = await self.note_service.update_note(note_id, payload)
            await self.db.commit()
            return result
        except Exception:
            await self.db.rollback()
            raise

    async def delete_note(self, note_id: uuid.UUID) -> None:
        try:
            existing = await self.note_service.get_note(note_id)
            company_id = await self._resolve_company_id_from_note(existing)
            await self._authorize_company_resource(
                resource="note",
                action="delete",
                company_id=company_id,
                contract_id=existing.contract_id,
            )
            await self.note_service.delete_note(note_id)
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise

    # --- Contact Persons ---

    async def list_contact_persons(self, customer_id: uuid.UUID) -> list[ContactPerson]:
        customer = await self.customer_service.get_customer(customer_id)
        await self._authorize_company_resource(
            resource="contact_person",
            action="list",
            company_id=customer.company_id,
        )
        return await self.contact_person_service.list_contacts(customer_id)

    async def create_contact_person(self, payload: ContactPersonCreate) -> ContactPerson:
        try:
            customer = await self.customer_service.get_customer(payload.customer_id)
            await self._authorize_company_resource(
                resource="contact_person",
                action="create",
                company_id=customer.company_id,
            )
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
            customer = await self.customer_service.get_customer(customer_id)
            await self._authorize_company_resource(
                resource="contact_person",
                action="update",
                company_id=customer.company_id,
            )
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
            customer = await self.customer_service.get_customer(customer_id)
            await self._authorize_company_resource(
                resource="contact_person",
                action="delete",
                company_id=customer.company_id,
            )
            await self.contact_person_service.delete_contact(customer_id, contact_id)
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise

    async def _authorize_company_resource(
        self,
        *,
        resource: str,
        action: str,
        company_id: uuid.UUID | None,
        contract_id: uuid.UUID | None = None,
    ) -> None:
        try:
            await self.authorization.authorize_by_policy(
                user=self.current_user,
                resource=resource,
                action=action,
                resource_company_id=company_id,
                resource_contract_id=contract_id,
            )
        except PermissionError as exc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "AUTHORIZATION_DENIED", "message": str(exc)},
            ) from exc

    async def _authorize_role_only(self, *, resource: str, action: str) -> None:
        try:
            min_role = self.authorization.get_policy_min_role(resource=resource, action=action)
            await self.authorization._authorize_with_min_role(
                user=self.current_user,
                min_role=min_role,
                allow_role_only=True,
            )
        except PermissionError as exc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "AUTHORIZATION_DENIED", "message": str(exc)},
            ) from exc

    async def _authorize_company_filter(self, *, resource: str, action: str, **kwargs: object) -> None:
        try:
            company_id = kwargs.get("company_id")
            if company_id:
                assert isinstance(company_id, uuid.UUID)  # nosec B101
                await self._authorize_company_resource(
                    resource=resource,
                    action=action,
                    company_id=company_id,
                )
                return

            await self._authorize_role_only(resource=resource, action=action)
        except PermissionError as exc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "AUTHORIZATION_DENIED", "message": str(exc)},
            ) from exc

    async def _authorize_contract_filter(
        self,
        *,
        resource: str,
        action: str,
        contract_id: uuid.UUID | None,
    ) -> None:
        try:
            if contract_id is not None:
                await self._authorize_contract_resource(
                    resource=resource,
                    action=action,
                    contract_id=contract_id,
                )
                return

            await self._authorize_role_only(resource=resource, action=action)
        except PermissionError as exc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "AUTHORIZATION_DENIED", "message": str(exc)},
            ) from exc

    async def _authorize_contract_resource(
        self,
        *,
        resource: str,
        action: str,
        contract_id: uuid.UUID,
    ) -> None:
        contract = await self.contract_service.get_contract(contract_id)
        company_id = await self._resolve_company_id_from_contract(contract)
        await self._authorize_company_resource(
            resource=resource,
            action=action,
            company_id=company_id,
            contract_id=contract.id,
        )

    async def _authorize_service_scope(self, service_id: uuid.UUID) -> None:
        scope = await self._get_user_scope()
        if scope.is_admin:
            await self._authorize_role_only(resource="service", action="read")
            return

        await self._authorize_role_only(resource="service", action="read")
        allowed_company_ids = await self._resolve_allowed_company_ids(scope)
        allowed_contract_ids = scope.contract_ids
        if not allowed_company_ids and not allowed_contract_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "AUTHORIZATION_DENIED", "message": "Access denied: user has no scope for requested resource."},
            )

        stmt = (
            select(ContractServiceModel.id)
            .join(Contract, Contract.id == ContractServiceModel.contract_id)
            .join(Customer, Customer.id == Contract.customer_id)
            .where(ContractServiceModel.service_id == service_id)
        )
        if allowed_contract_ids:
            stmt = stmt.where(Contract.id.in_(allowed_contract_ids))
        if allowed_company_ids:
            stmt = stmt.where(Customer.company_id.in_(allowed_company_ids))

        result = await self.db.execute(stmt.limit(1))
        if result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "AUTHORIZATION_DENIED", "message": "Access denied: user has no scope for requested resource."},
            )

    async def _get_user_scope(self) -> "_ScopeContext":
        roles = await self.authorization.get_user_roles(self.current_user.id)
        if UserRole.ADMIN in roles:
            return _ScopeContext(is_admin=True, company_ids=set(), contract_ids=set())
        company_ids = await self.authorization.get_user_company_scope(self.current_user.id)
        contract_ids = await self.authorization.get_user_contract_scope(self.current_user.id)
        return _ScopeContext(is_admin=False, company_ids=company_ids, contract_ids=contract_ids)

    async def _resolve_allowed_company_ids(self, scope: "_ScopeContext") -> set[uuid.UUID]:
        if scope.is_admin:
            return set()
        company_ids = set(scope.company_ids)
        if scope.contract_ids:
            company_ids.update(await self._resolve_company_ids_from_contract_ids(scope.contract_ids))
        return company_ids

    async def _resolve_company_ids_from_contract_ids(
        self, contract_ids: set[uuid.UUID]
    ) -> set[uuid.UUID]:
        if not contract_ids:
            return set()
        stmt = (
            select(Customer.company_id)
            .join(Contract, Contract.customer_id == Customer.id)
            .where(Contract.id.in_(contract_ids))
        )
        result = await self.db.execute(stmt)
        return {cid for cid in result.scalars().all() if cid is not None}

    async def _get_company_ids_for_customers(
        self, customer_ids: set[uuid.UUID]
    ) -> dict[uuid.UUID, uuid.UUID | None]:
        if not customer_ids:
            return {}
        stmt = select(Customer.id, Customer.company_id).where(Customer.id.in_(customer_ids))
        result = await self.db.execute(stmt)
        return {row[0]: row[1] for row in result.all()}

    async def _resolve_company_id_from_contract_id(
        self, contract_id: uuid.UUID
    ) -> uuid.UUID | None:
        stmt = (
            select(Customer.company_id)
            .join(Contract, Contract.customer_id == Customer.id)
            .where(Contract.id == contract_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _resolve_contract_id_from_rate(self, rate: CustomerRate) -> uuid.UUID | None:
        stmt = (
            select(Contract.id)
            .join(ContractServiceModel, ContractServiceModel.contract_id == Contract.id)
            .where(ContractServiceModel.id == rate.contract_service_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _resolve_contract_id_from_contract_service_id(
        self, contract_service_id: uuid.UUID
    ) -> uuid.UUID | None:
        stmt = select(ContractServiceModel.contract_id).where(
            ContractServiceModel.id == contract_service_id
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _resolve_company_id_from_contract(self, contract: Contract) -> uuid.UUID | None:
        customer = await self.customer_service.get_customer(contract.customer_id)
        return customer.company_id

    async def _resolve_company_id_from_note(self, note: Note) -> uuid.UUID | None:
        if note.customer_id:
            customer = await self.customer_service.get_customer(note.customer_id)
            return customer.company_id
        if note.contract_id:
            contract = await self.contract_service.get_contract(note.contract_id)
            return await self._resolve_company_id_from_contract(contract)
        return None

    async def _resolve_company_and_contract_from_note_payload(
        self, payload: NoteCreate
    ) -> tuple[uuid.UUID | None, uuid.UUID | None]:
        if payload.customer_id:
            customer = await self.customer_service.get_customer(payload.customer_id)
            return customer.company_id, None
        if payload.contract_id:
            contract = await self.contract_service.get_contract(payload.contract_id)
            company_id = await self._resolve_company_id_from_contract(contract)
            return company_id, contract.id
        return None, None
