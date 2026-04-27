"""feat: add company_id metadata to attachments

Revision ID: 40a1f8a0d4a7
Revises: dda74663e6ba
Create Date: 2026-04-27 15:45:00.000000

"""

import sqlalchemy as sa

from alembic import op

revision = "40a1f8a0d4a7"
down_revision = "dda74663e6ba"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("attachments", sa.Column("company_id", sa.UUID(), nullable=True))
    op.create_index("idx_att_company", "attachments", ["company_id"], unique=False)
    op.create_foreign_key(
        op.f("fk_attachments_company_id_companies"),
        "attachments",
        "companies",
        ["company_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("fk_attachments_company_id_companies"), "attachments", type_="foreignkey")
    op.drop_index("idx_att_company", table_name="attachments")
    op.drop_column("attachments", "company_id")
