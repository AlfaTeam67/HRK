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


class UserRole(enum.StrEnum):
    """Roles assignable to internal CRM users."""

    ADMIN = "admin"
    ACCOUNT_MANAGER = "account_manager"
    MANAGER = "manager"
    VIEWER = "viewer"


# ── Customers ────────────────────────────────────────────────────────────────


class CustomerStatus(enum.StrEnum):
    ACTIVE = "active"
    CHURN_RISK = "churn_risk"
    NEEDS_ATTENTION = "needs_attention"
    INACTIVE = "inactive"


# ── Contracts ────────────────────────────────────────────────────────────────


class ContractType(enum.StrEnum):
    RAMOWA = "ramowa"
    ANEKS = "aneks"
    SLA = "SLA"
    DPA = "DPA"
    PPK = "PPK"
    INNE = "inne"


class ContractStatus(enum.StrEnum):
    DRAFT = "draft"
    SIGNED = "signed"
    ACTIVE = "active"
    EXPIRING = "expiring"
    TERMINATED = "terminated"


class BillingCycle(enum.StrEnum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUAL = "annual"
    ONE_TIME = "one_time"


# ── Notes ────────────────────────────────────────────────────────────────────


class NoteType(enum.StrEnum):
    MEETING = "meeting"
    CALL = "call"
    INTERNAL = "internal"
    CLIENT_REQUEST = "client_request"
    OTHER = "other"


# ── Attachments / Documents ──────────────────────────────────────────────────


class DocumentType(enum.StrEnum):
    CONTRACT = "contract"
    AMENDMENT = "amendment"
    POWER_OF_ATTORNEY = "power_of_attorney"
    DPA = "DPA"
    PPK = "PPK"
    REPORT = "report"
    COVER_LETTER = "cover_letter"
    OTHER = "other"


class OcrStatus(enum.StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"
    SKIPPED = "skipped"


# ── Activity ─────────────────────────────────────────────────────────────────


class ActivityType(enum.StrEnum):
    MEETING = "meeting"
    EMAIL = "email"
    NOTE = "note"
    DOCUMENT = "document"
    VERIFICATION = "verification"
    CALL = "call"
    SYSTEM = "system"


# ── Customer Relation Scores ────────────────────────────────────────────────


class ScoreLabel(enum.StrEnum):
    GOOD = "good"
    NEEDS_ATTENTION = "needs_attention"
    CHURN_RISK = "churn_risk"


class CalculatedBy(enum.StrEnum):
    AI = "ai"
    MANUAL = "manual"


# ── Alerts ───────────────────────────────────────────────────────────────────


class AlertType(enum.StrEnum):
    CONTRACT_EXPIRY = "contract_expiry"
    VALORIZATION_OVERDUE = "valorization_overdue"
    NO_CONTACT = "no_contact"
    HIGH_DISCOUNT = "high_discount"
    CONTRACT_NOTICE = "contract_notice"
    CUSTOM = "custom"


class AlertStatus(enum.StrEnum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    SNOOZED = "snoozed"


# ── Services ─────────────────────────────────────────────────────────────────


class BillingUnit(enum.StrEnum):
    PER_PERSON = "per_person"
    RYCZALT = "ryczalt"
    PER_HOUR = "per_hour"
    PER_DOC = "per_doc"
    PER_ITEM = "per_item"


class BillingFrequency(enum.StrEnum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ONE_TIME = "one_time"
    ON_DEMAND = "on_demand"


# ── Valorizations ───────────────────────────────────────────────────────────


class IndexType(enum.StrEnum):
    GUS_CPI = "GUS_CPI"
    FIXED_PCT = "fixed_pct"
    CUSTOM = "custom"


class ValorizationStatus(enum.StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    APPLIED = "applied"
    REJECTED = "rejected"


# ── Document Generation ──────────────────────────────────────────────────────


class DocumentGenerationStatus(enum.StrEnum):
    """Lifecycle of an AI-assisted document generation."""

    DRAFT = "draft"           # initial preview, no PDF persisted yet
    PREVIEW = "preview"       # PDF rendered as draft (watermark), not finalized
    FINALIZED = "finalized"   # PDF locked, watermark removed, awaiting acceptance
    ACCEPTED = "accepted"     # reviewed and approved by user (ready to send)
    SENT = "sent"             # delivered to client
    SUPERSEDED = "superseded" # replaced by a regenerated version
    REJECTED = "rejected"


class DocumentTone(enum.StrEnum):
    """Stylistic tone for AI-generated narrative parts (cover letter, rationale)."""

    FORMAL = "formal"
    NEUTRAL = "neutral"
    WARM = "warm"
    ASSERTIVE = "assertive"


# ── Audit ────────────────────────────────────────────────────────────────────


class AuditAction(enum.StrEnum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    RESTORE = "RESTORE"
    VIEW = "VIEW"
