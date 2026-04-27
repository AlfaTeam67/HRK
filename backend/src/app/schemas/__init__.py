"""Schemas package."""

from app.schemas.common import MessageResponse, ORMBaseSchema
from app.schemas.contract_services import ContractServiceCreate, ContractServiceRead
from app.schemas.contracts import ContractCreate, ContractRead, ContractUpdate
from app.schemas.customer_rates import CustomerRateCreate, CustomerRateRead, CustomerRateUpdate
from app.schemas.customers import CustomerCreate, CustomerRead, CustomerUpdate
from app.schemas.service_groups import ServiceGroupCreate, ServiceGroupRead, ServiceGroupUpdate
from app.schemas.services import ServiceCreate, ServiceRead, ServiceUpdate
from app.schemas.valorizations import ValorizationCreate, ValorizationRead, ValorizationUpdate

__all__ = [
    "ORMBaseSchema",
    "MessageResponse",
    "CustomerCreate",
    "CustomerUpdate",
    "CustomerRead",
    "ContractCreate",
    "ContractUpdate",
    "ContractRead",
    "ServiceCreate",
    "ServiceUpdate",
    "ServiceRead",
    "ContractServiceCreate",
    "ContractServiceRead",
    "ServiceGroupCreate",
    "ServiceGroupUpdate",
    "ServiceGroupRead",
    "CustomerRateCreate",
    "CustomerRateUpdate",
    "CustomerRateRead",
    "ValorizationCreate",
    "ValorizationUpdate",
    "ValorizationRead",
]
