"""normalize enum values to lowercase

Revision ID: c3f8e2a1b0d9
Revises: 1b2c3d4e5f6a
Create Date: 2026-04-28 00:00:00.000000

"""

from alembic import op

revision = "c3f8e2a1b0d9"
down_revision = "1b2c3d4e5f6a"
branch_labels = None
depends_on = None

_ENUM_COLUMNS = [
    # (table, column, [uppercase_values_that_may_exist])
    ("customers",                "status",           ["ACTIVE", "CHURN_RISK", "NEEDS_ATTENTION", "INACTIVE"]),
    ("contracts",                "status",           ["DRAFT", "SIGNED", "ACTIVE", "EXPIRING", "TERMINATED"]),
    ("contracts",                "contract_type",    ["RAMOWA", "ANEKS", "SLA", "DPA", "PPK", "INNE"]),
    ("contracts",                "billing_cycle",    ["MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME"]),
    ("attachments",              "ocr_status",       ["PENDING", "PROCESSING", "DONE", "FAILED", "SKIPPED"]),
    ("attachments",              "document_type",    ["CONTRACT", "AMENDMENT", "POWER_OF_ATTORNEY", "DPA", "PPK", "REPORT", "OTHER"]),
    ("valorizations",            "status",           ["PENDING", "APPROVED", "APPLIED", "REJECTED"]),
    ("valorizations",            "index_type",       ["GUS_CPI", "FIXED_PCT", "CUSTOM"]),
    ("services",                 "billing_unit",     ["PER_PERSON", "RYCZALT", "PER_HOUR", "PER_DOC", "PER_ITEM"]),
    ("services",                 "billing_frequency",["MONTHLY", "QUARTERLY", "ONE_TIME", "ON_DEMAND"]),
    ("alerts",                   "alert_type",       ["CONTRACT_EXPIRY", "VALORIZATION_OVERDUE", "NO_CONTACT", "HIGH_DISCOUNT", "CONTRACT_NOTICE", "CUSTOM"]),
    ("alerts",                   "status",           ["OPEN", "ACKNOWLEDGED", "RESOLVED", "SNOOZED"]),
    ("notes",                    "note_type",        ["MEETING", "CALL", "INTERNAL", "CLIENT_REQUEST", "OTHER"]),
    ("activity_logs",            "activity_type",    ["MEETING", "EMAIL", "NOTE", "DOCUMENT", "VERIFICATION", "CALL", "SYSTEM"]),
    ("customer_relation_scores", "score_label",      ["GOOD", "NEEDS_ATTENTION", "CHURN_RISK"]),
    ("customer_relation_scores", "calculated_by",    ["AI", "MANUAL"]),
    ("audit_logs",               "action",           ["CREATE", "UPDATE", "DELETE", "RESTORE", "VIEW"]),
]


def upgrade() -> None:
    for table, column, values in _ENUM_COLUMNS:
        for val in values:
            op.execute(
                f"UPDATE {table} SET {column} = '{val.lower()}' WHERE {column} = '{val}'"
            )


def downgrade() -> None:
    for table, column, values in _ENUM_COLUMNS:
        for val in values:
            op.execute(
                f"UPDATE {table} SET {column} = '{val}' WHERE {column} = '{val.lower()}'"
            )
