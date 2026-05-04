"""add gus cpi snapshots

Revision ID: d4e9f2a1c7b8
Revises: b9813a3347a3
Create Date: 2026-05-04 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "d4e9f2a1c7b8"
down_revision = "b9813a3347a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "gus_cpi_snapshots",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("quarter", sa.Integer(), nullable=False),
        sa.Column("value", sa.Numeric(6, 2), nullable=False),
        sa.Column("source", sa.String(length=50), server_default=sa.text("'GUS BDL'"), nullable=False),
        sa.Column(
            "fetched_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_gus_cpi_snapshots")),
        sa.UniqueConstraint("year", "quarter", name="uq_gus_cpi_year_quarter"),
    )
    op.create_index("idx_gus_cpi_period", "gus_cpi_snapshots", ["year", "quarter"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_gus_cpi_period", table_name="gus_cpi_snapshots")
    op.drop_table("gus_cpi_snapshots")
