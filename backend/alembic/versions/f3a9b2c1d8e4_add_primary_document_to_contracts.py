"""feat: add primary_document_id to contracts

Revision ID: f3a9b2c1d8e4
Revises: d7e2c1f4a9b3
Create Date: 2026-05-21 12:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

revision = "f3a9b2c1d8e4"
down_revision = "d7e2c1f4a9b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "contracts",
        sa.Column("primary_document_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_contracts_primary_document_id_attachments"),
        "contracts",
        "attachments",
        ["primary_document_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("fk_contracts_primary_document_id_attachments"),
        "contracts",
        type_="foreignkey",
    )
    op.drop_column("contracts", "primary_document_id")
