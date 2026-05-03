"""add email index to contact_persons

Revision ID: a1b2c3d4e5f6
Revises: 40a1f8a0d4a7
Create Date: 2026-04-30 00:00:00.000000

"""

from alembic import op

revision = "a1b2c3d4e5f6"
down_revision = "40a1f8a0d4a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("idx_contact_persons_email", "contact_persons", ["email"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_contact_persons_email", table_name="contact_persons")
