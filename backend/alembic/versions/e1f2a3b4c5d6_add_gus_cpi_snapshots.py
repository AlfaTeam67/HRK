"""add gus_cpi_snapshots table

Revision ID: e1f2a3b4c5d6
Revises: b9813a3347a3
Create Date: 2026-05-17 12:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers
revision = "e1f2a3b4c5d6"
down_revision = "b9813a3347a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create gus_cpi_snapshots table."""
    op.create_table(
        "gus_cpi_snapshots",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("quarter", sa.Integer(), nullable=False),
        sa.Column("value", sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column("source", sa.String(length=50), server_default="GUS BDL", nullable=False),
        sa.Column("fetched_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_gus_cpi_snapshots")),
        sa.UniqueConstraint("year", "quarter", name="uq_gus_cpi_snapshots_year_quarter"),
    )
    op.create_index("idx_gus_cpi_year_quarter", "gus_cpi_snapshots", ["year", "quarter"])


def downgrade() -> None:
    """Drop gus_cpi_snapshots table."""
    op.drop_index("idx_gus_cpi_year_quarter", table_name="gus_cpi_snapshots")
    op.drop_table("gus_cpi_snapshots")
