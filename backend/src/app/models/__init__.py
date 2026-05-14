"""SQLAlchemy models — public re-exports.

Every model must be imported here so that:
  1. ``Base.metadata`` is aware of all tables (Alembic autogenerate).
  2. Relationship back-references resolve correctly.
"""

# Tier 5 — CRM Activity
from app.models.activity import ActivityLog
from app.models.alert import Alert
from app.models.attachment import Attachment

# Tier 6 — Audit
from app.models.audit import AuditLog
from app.models.base import (
    AuditMixin,
    Base,
    CreatedAtMixin,
    SoftDeleteMixin,
    TimestampMixin,
)

# Tier 1 — Core
from app.models.company import Company

# Tier 2 — Contracts
from app.models.contract import Contract, ContractAmendment
from app.models.contract_service import ContractService
from app.models.customer import ContactPerson, Customer
from app.models.document_chunk import DocumentChunk
from app.models.document_generation import DocumentGeneration
from app.models.enums import (
    ActivityType,
    AlertStatus,
    AlertType,
    AuditAction,
    BillingCycle,
    BillingFrequency,
    BillingUnit,
    CalculatedBy,
    ContractStatus,
    ContractType,
    CustomerStatus,
    DocumentGenerationStatus,
    DocumentTone,
    DocumentType,
    IndexType,
    NoteType,
    OcrStatus,
    ScoreLabel,
    UserRole,
    ValorizationStatus,
)

# Tier 4 — Documents & Notes
from app.models.note import Note
from app.models.rate import CustomerRate, CustomerRateMonth, Valorization
from app.models.score import CustomerRelationScore
from app.models.service import Service

# Tier 3 — Services & Rates
from app.models.service_group import ServiceGroup
from app.models.user import User

__all__ = [
    # Base & Mixins
    "Base",
    "TimestampMixin",
    "CreatedAtMixin",
    "SoftDeleteMixin",
    "AuditMixin",
    # Enums
    "UserRole",
    "CustomerStatus",
    "ContractType",
    "ContractStatus",
    "BillingCycle",
    "NoteType",
    "DocumentType",
    "OcrStatus",
    "ActivityType",
    "ScoreLabel",
    "CalculatedBy",
    "AlertType",
    "AlertStatus",
    "BillingUnit",
    "BillingFrequency",
    "IndexType",
    "ValorizationStatus",
    "AuditAction",
    "DocumentGenerationStatus",
    "DocumentTone",
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
    "CustomerRateMonth",
    "Valorization",
    # Tier 4
    "Note",
    "Attachment",
    "DocumentChunk",
    "DocumentGeneration",
    # Tier 5
    "ActivityLog",
    "CustomerRelationScore",
    "Alert",
    # Tier 6
    "AuditLog",
]
