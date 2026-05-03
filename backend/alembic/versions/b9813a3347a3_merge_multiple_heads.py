"""merge multiple heads

Revision ID: b9813a3347a3
Revises: a1b2c3d4e5f6, c3f8e2a1b0d9
Create Date: 2026-05-03 13:45:00.825077

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = 'b9813a3347a3'
down_revision = ('a1b2c3d4e5f6', 'c3f8e2a1b0d9')
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Apply migration."""
    pass


def downgrade() -> None:
    """Revert migration."""
    pass
