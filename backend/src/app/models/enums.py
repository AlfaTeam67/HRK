"""Python enumerations for CRM domain models.

Using ``str, enum.Enum`` as base so that values serialise to plain strings
in JSON / Pydantic while still being type-safe at the Python layer.

SQLAlchemy columns reference these via::

    sqlalchemy.Enum(MyEnum, name="myenum", create_constraint=False, native_enum=False)

``native_enum=False`` stores values as VARCHAR — no ``CREATE TYPE`` in
PostgreSQL, which avoids painful ``ALTER TYPE … ADD VALUE`` migrations.
"""

import enum

# ── Users ────────────────────────────────────────────────────────────────────


class UserRole(str, enum.Enum):
    """Roles assignable to internal CRM users."""

    ADMIN = "admin"
    ACCOUNT_MANAGER = "account_manager"
    MANAGER = "manager"
    VIEWER = "viewer"


# ── Customers ────────────────────────────────────────────────────────────────


class CustomerStatus(str, enum.Enum):
    ACTIVE = "active"
    CHURN_RISK = "churn_risk"
    NEEDS_ATTENTION = "needs_attention"
    INACTIVE = "inactive"


# ── Contracts ────────────────────────────────────────────────────────────────


class ContractType(str, enum.Enum):
    RAMOWA = "ramowa"
    ANEKS = "aneks"
    SLA = "SLA"
    DPA = "DPA"
    PPK = "PPK"
    INNE = "inne"


class ContractStatus(str, enum.Enum):
    DRAFT = "draft"
    SIGNED = "signed"
    ACTIVE = "active"
    EXPIRING = "expiring"
    TERMINATED = "terminated"


class BillingCycle(str, enum.Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUAL = "annual"
    ONE_TIME = "one_time"


# ── Notes ────────────────────────────────────────────────────────────────────


class NoteType(str, enum.Enum):
    MEETING = "meeting"
    CALL = "call"
    INTERNAL = "internal"
    CLIENT_REQUEST = "client_request"
    OTHER = "other"


# ── Attachments / Documents ──────────────────────────────────────────────────


class DocumentType(str, enum.Enum):
    CONTRACT = "contract"
    AMENDMENT = "amendment"
    POWER_OF_ATTORNEY = "power_of_attorney"
    DPA = "DPA"
    PPK = "PPK"
    REPORT = "report"
    OTHER = "other"


class OcrStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"
    SKIPPED = "skipped"


# ── Activity ─────────────────────────────────────────────────────────────────


class ActivityType(str, enum.Enum):
    MEETING = "meeting"
    EMAIL = "email"
    NOTE = "note"
    DOCUMENT = "document"
    VERIFICATION = "verification"
    CALL = "call"
    SYSTEM = "system"


# ── Customer Relation Scores ────────────────────────────────────────────────


class ScoreLabel(str, enum.Enum):
    GOOD = "good"
    NEEDS_ATTENTION = "needs_attention"
    CHURN_RISK = "churn_risk"


class CalculatedBy(str, enum.Enum):
    AI = "ai"
    MANUAL = "manual"


# ── Alerts ───────────────────────────────────────────────────────────────────


class AlertType(str, enum.Enum):
    CONTRACT_EXPIRY = "contract_expiry"
    VALORIZATION_OVERDUE = "valorization_overdue"
    NO_CONTACT = "no_contact"
    HIGH_DISCOUNT = "high_discount"
    CONTRACT_NOTICE = "contract_notice"
    CUSTOM = "custom"


class AlertStatus(str, enum.Enum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    SNOOZED = "snoozed"


# ── Services ─────────────────────────────────────────────────────────────────


class BillingUnit(str, enum.Enum):
    PER_PERSON = "per_person"
    RYCZALT = "ryczalt"
    PER_HOUR = "per_hour"
    PER_DOC = "per_doc"
    PER_ITEM = "per_item"


class BillingFrequency(str, enum.Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ONE_TIME = "one_time"
    ON_DEMAND = "on_demand"


# ── Valorizations ───────────────────────────────────────────────────────────


class IndexType(str, enum.Enum):
    GUS_CPI = "GUS_CPI"
    FIXED_PCT = "fixed_pct"
    CUSTOM = "custom"


class ValorizationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    APPLIED = "applied"
    REJECTED = "rejected"


# ── Audit ────────────────────────────────────────────────────────────────────


class AuditAction(str, enum.Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    RESTORE = "RESTORE"
    VIEW = "VIEW"
