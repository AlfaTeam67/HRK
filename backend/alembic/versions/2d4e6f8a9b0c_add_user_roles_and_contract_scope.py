"""add user roles table and contract access scope

Revision ID: 2d4e6f8a9b0c
Revises: 0a1b2c3d4e5f
Create Date: 2026-05-04 10:50:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "2d4e6f8a9b0c"
down_revision = "b9813a3347a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "user_company_access" not in table_names:
        op.create_table(
            "user_company_access",
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
                primary_key=True,
            ),
            sa.Column(
                "company_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("companies.id", ondelete="CASCADE"),
                nullable=False,
                primary_key=True,
            ),
        )

    if "user_roles" not in table_names:
        op.create_table(
            "user_roles",
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
                primary_key=True,
            ),
            sa.Column(
                "role",
                sa.Enum(
                    "admin",
                    "account_manager",
                    "manager",
                    "consultant",
                    "viewer",
                    name="userrole",
                    native_enum=False,
                ),
                nullable=False,
                primary_key=True,
            ),
        )

    if "user_contract_access" not in table_names:
        op.create_table(
            "user_contract_access",
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
                primary_key=True,
            ),
            sa.Column(
                "contract_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("contracts.id", ondelete="CASCADE"),
                nullable=False,
                primary_key=True,
            ),
        )

    users_columns = {column["name"] for column in inspector.get_columns("users")}

    if "role" in users_columns:
        op.execute(
            """
            INSERT INTO user_roles (user_id, role)
            SELECT id, role::varchar
            FROM users
            WHERE role IS NOT NULL
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "user_contract_access" in table_names:
        op.drop_table("user_contract_access")
    if "user_roles" in table_names:
        op.drop_table("user_roles")
    if "user_company_access" in table_names:
        op.drop_table("user_company_access")
