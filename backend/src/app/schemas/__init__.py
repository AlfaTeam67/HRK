"""Schemas package."""

from app.schemas.activity import ActivityLogCreate, ActivityLogRead
from app.schemas.common import MessageResponse, ORMBaseSchema
from app.schemas.contact_person import (
    ContactPersonCreate,
    ContactPersonRead,
    ContactPersonUpdate,
)
from app.schemas.contract_services import ContractServiceCreate, ContractServiceRead
from app.schemas.contracts import ContractCreate, ContractRead, ContractUpdate
from app.schemas.customer_rates import CustomerRateCreate, CustomerRateRead, CustomerRateUpdate
from app.schemas.customers import CustomerCreate, CustomerRead, CustomerUpdate
from app.schemas.notes import NoteCreate, NoteRead, NoteUpdate
from app.schemas.service_groups import ServiceGroupCreate, ServiceGroupRead, ServiceGroupUpdate
from app.schemas.services import ServiceCreate, ServiceRead, ServiceUpdate
from app.schemas.timeline import TimelineEventRead
from app.schemas.valorizations import ValorizationCreate, ValorizationRead, ValorizationUpdate

__all__ = [
    "ORMBaseSchema",
    "MessageResponse",
    "ActivityLogCreate",
    "ActivityLogRead",
    "ContractCreate",
    "ContractRead",
    "ContractServiceCreate",
    "ContractServiceRead",
    "ContractUpdate",
    "CustomerCreate",
    "CustomerRateCreate",
    "CustomerRateRead",
    "CustomerRateUpdate",
    "CustomerRead",
    "CustomerUpdate",
    "NoteCreate",
    "NoteRead",
    "NoteUpdate",
    "ServiceCreate",
    "ServiceGroupCreate",
    "ServiceGroupRead",
    "ServiceGroupUpdate",
    "ServiceRead",
    "ServiceUpdate",
    "ValorizationCreate",
    "ValorizationRead",
    "ValorizationUpdate",
    "TimelineEventRead",
    "ContactPersonCreate",
    "ContactPersonUpdate",
    "ContactPersonRead",
]
