"""Business logic services module."""

from app.service.contact_persons import ContactPersonService
from app.service.contract_services import ContractServiceRelationService
from app.service.contracts import ContractService
from app.service.customer_rates import CustomerRateCrudService
from app.service.customers import CustomerService
from app.service.facade import CRMService
from app.service.service_groups import ServiceGroupCrudService
from app.service.services import ServiceCrudService
from app.service.valorizations import ValorizationCrudService

__all__ = [
    "CRMService",
    "CustomerService",
    "ContractService",
    "ServiceCrudService",
    "ContractServiceRelationService",
    "ServiceGroupCrudService",
    "CustomerRateCrudService",
    "ValorizationCrudService",
    "ContactPersonService",
]
