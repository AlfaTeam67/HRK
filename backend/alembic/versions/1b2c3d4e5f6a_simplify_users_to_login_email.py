"""simplify users to login/email only

Revision ID: 1b2c3d4e5f6a
Revises: dda74663e6ba
Create Date: 2026-04-27 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "1b2c3d4e5f6a"
down_revision = "dda74663e6ba"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("users", "ad_username", new_column_name="login")
    op.drop_constraint("uq_users_ad_username", "users", type_="unique")
    op.create_unique_constraint("uq_users_login", "users", ["login"])
    op.drop_column("users", "first_name")
    op.drop_column("users", "last_name")
    op.drop_column("users", "department")
    op.drop_column("users", "role")
    op.drop_column("users", "is_active")
    op.drop_column("users", "last_login_at")


def downgrade() -> None:
    op.drop_constraint("uq_users_login", "users", type_="unique")
    op.add_column("users", sa.Column("last_login_at", sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column("users", sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False))
    op.add_column("users", sa.Column("role", sa.String(length=50), nullable=False))
    op.add_column("users", sa.Column("department", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(length=100), nullable=False))
    op.add_column("users", sa.Column("first_name", sa.String(length=100), nullable=False))
    op.alter_column("users", "login", new_column_name="ad_username")
    op.create_unique_constraint("uq_users_ad_username", "users", ["ad_username"])
