"""add include_in_ai_assistant to attachments

Revision ID: b8c9d0e1f2a3
Revises: a2b3c4d5e6f7
Create Date: 2026-05-26 22:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b8c9d0e1f2a3"
down_revision: str | Sequence[str] | None = "a2b3c4d5e6f7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "attachments",
        sa.Column(
            "include_in_ai_assistant",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.create_index(
        "idx_att_include_in_ai_assistant",
        "attachments",
        ["include_in_ai_assistant"],
        unique=False,
        postgresql_where=sa.text("include_in_ai_assistant = TRUE"),
    )


def downgrade() -> None:
    op.drop_index("idx_att_include_in_ai_assistant", table_name="attachments")
    op.drop_column("attachments", "include_in_ai_assistant")
