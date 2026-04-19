"""SQLAlchemy models — public re-exports.

Every model must be imported here so that:
  1. ``Base.metadata`` is aware of all tables (Alembic autogenerate).
  2. Relationship back-references resolve correctly.
"""

from app.models.base import Base, TimestampMixin

# Tier 1 — Core
from app.models.company import Company
from app.models.user import User
from app.models.customer import ContactPerson, Customer

# Tier 2 — Contracts
from app.models.contract import Contract, ContractAmendment

# Tier 3 — Services & Rates
from app.models.service import ContractService, Service, ServiceGroup
from app.models.rate import CustomerRate, Valorization

# Tier 4 — Documents & Notes
from app.models.document import Attachment, DocumentChunk, Note

# Tier 5 — CRM Activity
from app.models.activity import ActivityLog, Alert, CustomerRelationScore

# Tier 6 — Audit
from app.models.audit import AuditLog

__all__ = [
    "Base",
    "TimestampMixin",
    # Tier 1
    "Company",
    "User",
    "Customer",
    "ContactPerson",
    # Tier 2
    "Contract",
    "ContractAmendment",
    # Tier 3
    "ServiceGroup",
    "Service",
    "ContractService",
    "CustomerRate",
    "Valorization",
    # Tier 4
    "Note",
    "Attachment",
    "DocumentChunk",
    # Tier 5
    "ActivityLog",
    "CustomerRelationScore",
    "Alert",
    # Tier 6
    "AuditLog",
]
