"""add_custom_data_tables

Revision ID: 5af0b6c91dfa
Revises: b8c9d0e1f2a3
Create Date: 2026-06-05 22:30:12.999609

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '5af0b6c91dfa'
down_revision = 'b8c9d0e1f2a3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Apply migration."""
    op.create_table('custom_field_definitions',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('customer_id', sa.UUID(), nullable=False),
    sa.Column('field_name', sa.String(length=100), nullable=False),
    sa.Column('field_type', sa.String(length=20), nullable=False),
    sa.Column('display_name', sa.String(length=255), nullable=False),
    sa.Column('sort_order', sa.Integer(), server_default=sa.text('0'), nullable=False),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_custom_field_definitions_created_by_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], name=op.f('fk_custom_field_definitions_customer_id_customers'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_custom_field_definitions')),
    sa.UniqueConstraint('customer_id', 'field_name', name='uq_custom_field_customer_name')
    )
    op.create_index('idx_custom_field_defs_customer', 'custom_field_definitions', ['customer_id'], unique=False)
    op.create_table('custom_table_definitions',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('customer_id', sa.UUID(), nullable=False),
    sa.Column('table_slug', sa.String(length=100), nullable=False),
    sa.Column('display_name', sa.String(length=255), nullable=False),
    sa.Column('db_table_name', sa.String(length=255), nullable=False),
    sa.Column('sort_order', sa.Integer(), server_default=sa.text('0'), nullable=False),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_custom_table_definitions_created_by_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], name=op.f('fk_custom_table_definitions_customer_id_customers'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_custom_table_definitions')),
    sa.UniqueConstraint('customer_id', 'table_slug', name='uq_custom_table_customer_slug'),
    sa.UniqueConstraint('db_table_name', name=op.f('uq_custom_table_definitions_db_table_name'))
    )
    op.create_index('idx_custom_table_defs_customer', 'custom_table_definitions', ['customer_id'], unique=False)
    op.create_table('custom_column_definitions',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('table_def_id', sa.UUID(), nullable=False),
    sa.Column('column_name', sa.String(length=100), nullable=False),
    sa.Column('column_type', sa.String(length=20), nullable=False),
    sa.Column('display_name', sa.String(length=255), nullable=False),
    sa.Column('sort_order', sa.Integer(), server_default=sa.text('0'), nullable=False),
    sa.ForeignKeyConstraint(['table_def_id'], ['custom_table_definitions.id'], name=op.f('fk_custom_column_definitions_table_def_id_custom_table_definitions'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_custom_column_definitions')),
    sa.UniqueConstraint('table_def_id', 'column_name', name='uq_custom_col_table_name')
    )
    op.create_index('idx_custom_col_defs_table', 'custom_column_definitions', ['table_def_id'], unique=False)


def downgrade() -> None:
    """Revert migration."""
    op.drop_index('idx_custom_col_defs_table', table_name='custom_column_definitions')
    op.drop_table('custom_column_definitions')
    op.drop_index('idx_custom_table_defs_customer', table_name='custom_table_definitions')
    op.drop_table('custom_table_definitions')
    op.drop_index('idx_custom_field_defs_customer', table_name='custom_field_definitions')
    op.drop_table('custom_field_definitions')
