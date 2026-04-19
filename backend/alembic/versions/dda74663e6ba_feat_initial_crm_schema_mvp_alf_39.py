"""feat: initial CRM schema MVP (ALF-39)

Revision ID: dda74663e6ba
Revises:
Create Date: 2026-04-19 10:10:46.417144

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'dda74663e6ba'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Apply migration."""

    # ── Tier 0: independent tables ────────────────────────────────────────

    op.create_table('companies',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('nip', sa.String(length=15), nullable=True),
        sa.Column('regon', sa.String(length=14), nullable=True),
        sa.Column('krs', sa.String(length=20), nullable=True),
        sa.Column('address_street', sa.String(length=255), nullable=True),
        sa.Column('address_city', sa.String(length=255), nullable=True),
        sa.Column('address_postal', sa.String(length=10), nullable=True),
        sa.Column('address_country', sa.String(length=2), server_default=sa.text("'PL'"), nullable=True),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('website', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('additional_data', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_companies')),
        sa.UniqueConstraint('nip', name=op.f('uq_companies_nip')),
    )

    op.create_table('users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('ad_username', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=False),
        sa.Column('last_name', sa.String(length=100), nullable=False),
        sa.Column('department', sa.String(length=100), nullable=True),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('last_login_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("role IN ('admin', 'account_manager', 'manager', 'viewer')", name=op.f('ck_users_role_check')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_users')),
        sa.UniqueConstraint('ad_username', name=op.f('uq_users_ad_username')),
        sa.UniqueConstraint('email', name=op.f('uq_users_email')),
    )

    op.create_table('service_groups',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('parent_id', sa.UUID(), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('service_code', sa.String(length=20), nullable=True),
        sa.Column('level', sa.Integer(), server_default=sa.text('1'), nullable=False),
        sa.Column('path_id', sa.String(length=50), nullable=True),
        sa.Column('path_name', sa.String(length=500), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['parent_id'], ['service_groups.id'], name=op.f('fk_service_groups_parent_id_service_groups'), ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_service_groups')),
        sa.UniqueConstraint('path_id', name=op.f('uq_service_groups_path_id')),
    )

    # ── Tier 1: depend on companies / users ──────────────────────────────

    op.create_table('customers',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('ckk', sa.String(length=10), nullable=False),
        sa.Column('ckd', sa.String(length=10), nullable=True),
        sa.Column('company_id', sa.UUID(), nullable=True),
        sa.Column('account_manager_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.String(length=30), server_default=sa.text("'active'"), nullable=False),
        sa.Column('segment', sa.String(length=50), nullable=True),
        sa.Column('industry', sa.String(length=100), nullable=True),
        sa.Column('employee_count', sa.Integer(), nullable=True),
        sa.Column('payment_period_days', sa.Integer(), server_default=sa.text('21'), nullable=True),
        sa.Column('account_number', sa.String(length=30), nullable=True),
        sa.Column('billing_nip', sa.String(length=15), nullable=True),
        sa.Column('billing_email', sa.String(length=255), nullable=True),
        sa.Column('invoice_nip', sa.String(length=15), nullable=True),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('address_street', sa.String(length=255), nullable=True),
        sa.Column('address_city', sa.String(length=255), nullable=True),
        sa.Column('address_postal', sa.String(length=10), nullable=True),
        sa.Column('address_country', sa.String(length=2), server_default=sa.text("'PL'"), nullable=True),
        sa.Column('additional_data', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('updated_by', sa.UUID(), nullable=True),
        sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("status IN ('active', 'churn_risk', 'needs_attention', 'inactive')", name=op.f('ck_customers_status_check')),
        sa.ForeignKeyConstraint(['account_manager_id'], ['users.id'], name=op.f('fk_customers_account_manager_id_users'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], name=op.f('fk_customers_company_id_companies'), ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_customers_created_by_users'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], name=op.f('fk_customers_updated_by_users'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_customers')),
        sa.UniqueConstraint('ckd', name=op.f('uq_customers_ckd')),
        sa.UniqueConstraint('ckk', name=op.f('uq_customers_ckk')),
    )
    op.create_index('idx_customers_account_manager', 'customers', ['account_manager_id'], unique=False)
    op.create_index('idx_customers_ckd', 'customers', ['ckd'], unique=True)
    op.create_index('idx_customers_ckk', 'customers', ['ckk'], unique=True)
    op.create_index('idx_customers_deleted_at', 'customers', ['deleted_at'], unique=False)
    op.create_index('idx_customers_status', 'customers', ['status'], unique=False)

    op.create_table('audit_logs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('entity_id', sa.UUID(), nullable=False),
        sa.Column('action', sa.String(length=20), nullable=False),
        sa.Column('old_values', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('new_values', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("action IN ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'VIEW')", name=op.f('ck_audit_logs_action_check')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_audit_logs_user_id_users'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_audit_logs')),
    )
    op.create_index('idx_audit_created', 'audit_logs', ['created_at'], unique=False)
    op.create_index('idx_audit_entity', 'audit_logs', ['entity_type', 'entity_id'], unique=False)
    op.create_index('idx_audit_user', 'audit_logs', ['user_id'], unique=False)

    op.create_table('services',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('group_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('billing_unit', sa.String(length=30), nullable=False),
        sa.Column('billing_frequency', sa.String(length=20), server_default=sa.text("'monthly'"), nullable=False),
        sa.Column('vat_rate', sa.Numeric(precision=4, scale=2), server_default=sa.text('23.00'), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('additional_data', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.CheckConstraint("billing_frequency IN ('monthly', 'quarterly', 'one_time', 'on_demand')", name=op.f('ck_services_billing_frequency_check')),
        sa.CheckConstraint("billing_unit IN ('per_person', 'ryczalt', 'per_hour', 'per_doc', 'per_item')", name=op.f('ck_services_billing_unit_check')),
        sa.ForeignKeyConstraint(['group_id'], ['service_groups.id'], name=op.f('fk_services_group_id_service_groups'), ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_services')),
    )

    # ── Tier 2: depend on customers / users ──────────────────────────────

    op.create_table('contact_persons',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('customer_id', sa.UUID(), nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=False),
        sa.Column('last_name', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('role', sa.String(length=100), nullable=True),
        sa.Column('is_primary', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('is_contract_signer', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('additional_data', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], name=op.f('fk_contact_persons_customer_id_customers'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_contact_persons')),
    )

    op.create_table('contracts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('customer_id', sa.UUID(), nullable=False),
        sa.Column('account_manager_id', sa.UUID(), nullable=True),
        sa.Column('contract_number', sa.String(length=50), nullable=False),
        sa.Column('contract_type', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), server_default=sa.text("'draft'"), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('notice_period_days', sa.Integer(), server_default=sa.text('90'), nullable=True),
        sa.Column('notice_conditions', sa.Text(), nullable=True),
        sa.Column('billing_cycle', sa.String(length=20), server_default=sa.text("'monthly'"), nullable=True),
        sa.Column('governing_law', sa.String(length=10), server_default=sa.text("'PL'"), nullable=True),
        sa.Column('parent_contract_id', sa.UUID(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('additional_data', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('updated_by', sa.UUID(), nullable=True),
        sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("billing_cycle IN ('monthly', 'quarterly', 'annual', 'one_time')", name=op.f('ck_contracts_billing_cycle_check')),
        sa.CheckConstraint("contract_type IN ('ramowa', 'aneks', 'SLA', 'DPA', 'PPK', 'inne')", name=op.f('ck_contracts_contract_type_check')),
        sa.CheckConstraint("status IN ('draft', 'signed', 'active', 'expiring', 'terminated')", name=op.f('ck_contracts_status_check')),
        sa.ForeignKeyConstraint(['account_manager_id'], ['users.id'], name=op.f('fk_contracts_account_manager_id_users'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_contracts_created_by_users'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], name=op.f('fk_contracts_customer_id_customers'), ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['parent_contract_id'], ['contracts.id'], name=op.f('fk_contracts_parent_contract_id_contracts'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], name=op.f('fk_contracts_updated_by_users'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_contracts')),
        sa.UniqueConstraint('contract_number', name=op.f('uq_contracts_contract_number')),
    )
    op.create_index('idx_contracts_customer_status', 'contracts', ['customer_id', 'status'], unique=False)
    op.create_index('idx_contracts_deleted_at', 'contracts', ['deleted_at'], unique=False)
    op.create_index('idx_contracts_end_date', 'contracts', ['end_date'], unique=False)
    op.create_index('idx_contracts_number', 'contracts', ['contract_number'], unique=True)

    op.create_table('customer_relation_scores',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('customer_id', sa.UUID(), nullable=False),
        sa.Column('score_date', sa.Date(), nullable=False),
        sa.Column('score_label', sa.String(length=20), nullable=False),
        sa.Column('score_value', sa.Numeric(precision=3, scale=2), nullable=False),
        sa.Column('reasoning', sa.Text(), nullable=True),
        sa.Column('calculated_by', sa.String(length=10), server_default=sa.text("'ai'"), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("calculated_by IN ('ai', 'manual')", name=op.f('ck_customer_relation_scores_calculated_by_check')),
        sa.CheckConstraint("score_label IN ('good', 'needs_attention', 'churn_risk')", name=op.f('ck_customer_relation_scores_score_label_check')),
        sa.CheckConstraint('score_value BETWEEN 0.00 AND 1.00', name=op.f('ck_customer_relation_scores_score_value_range')),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], name=op.f('fk_customer_relation_scores_customer_id_customers'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_customer_relation_scores')),
        sa.UniqueConstraint('customer_id', 'score_date', name='uq_score_customer_date'),
    )
    op.create_index('idx_score_customer_date', 'customer_relation_scores', ['customer_id', 'score_date'], unique=False)

    # ── Tier 3: depend on contracts ──────────────────────────────────────

    op.create_table('activity_logs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('customer_id', sa.UUID(), nullable=True),
        sa.Column('contract_id', sa.UUID(), nullable=True),
        sa.Column('activity_type', sa.String(length=30), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('performed_by', sa.UUID(), nullable=True),
        sa.Column('activity_date', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('additional_data', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("activity_type IN ('meeting', 'email', 'note', 'document', 'verification', 'call', 'system')", name=op.f('ck_activity_logs_activity_type_check')),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], name=op.f('fk_activity_logs_contract_id_contracts'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], name=op.f('fk_activity_logs_customer_id_customers'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['performed_by'], ['users.id'], name=op.f('fk_activity_logs_performed_by_users'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_activity_logs')),
    )
    op.create_index('idx_act_contract', 'activity_logs', ['contract_id'], unique=False)
    op.create_index('idx_act_customer_date', 'activity_logs', ['customer_id', 'activity_date'], unique=False)

    op.create_table('alerts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('customer_id', sa.UUID(), nullable=True),
        sa.Column('contract_id', sa.UUID(), nullable=True),
        sa.Column('alert_type', sa.String(length=40), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=True),
        sa.Column('entity_id', sa.UUID(), nullable=True),
        sa.Column('status', sa.String(length=20), server_default=sa.text("'open'"), nullable=False),
        sa.Column('trigger_date', sa.Date(), nullable=False),
        sa.Column('days_before', sa.Integer(), nullable=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('assigned_to', sa.UUID(), nullable=True),
        sa.Column('acknowledged_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("alert_type IN ('contract_expiry', 'valorization_overdue', 'no_contact', 'high_discount', 'contract_notice', 'custom')", name=op.f('ck_alerts_alert_type_check')),
        sa.CheckConstraint("status IN ('open', 'acknowledged', 'resolved', 'snoozed')", name=op.f('ck_alerts_status_check')),
        sa.ForeignKeyConstraint(['assigned_to'], ['users.id'], name=op.f('fk_alerts_assigned_to_users'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], name=op.f('fk_alerts_contract_id_contracts'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], name=op.f('fk_alerts_customer_id_customers'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_alerts')),
    )
    op.create_index('idx_alert_assigned', 'alerts', ['assigned_to', 'status'], unique=False)
    op.create_index('idx_alert_customer', 'alerts', ['customer_id'], unique=False)
    op.create_index('idx_alert_trigger_status', 'alerts', ['trigger_date', 'status'], unique=False)

    op.create_table('notes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('customer_id', sa.UUID(), nullable=True),
        sa.Column('contract_id', sa.UUID(), nullable=True),
        sa.Column('note_type', sa.String(length=30), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.CheckConstraint("note_type IN ('meeting', 'call', 'internal', 'client_request', 'other')", name=op.f('ck_notes_note_type_check')),
        sa.CheckConstraint('customer_id IS NOT NULL OR contract_id IS NOT NULL', name=op.f('ck_notes_note_parent_check')),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], name=op.f('fk_notes_contract_id_contracts'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_notes_created_by_users'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], name=op.f('fk_notes_customer_id_customers'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_notes')),
    )
    op.create_index('idx_notes_contract', 'notes', ['contract_id'], unique=False)
    op.create_index('idx_notes_customer', 'notes', ['customer_id'], unique=False)

    op.create_table('contract_services',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('contract_id', sa.UUID(), nullable=False),
        sa.Column('service_id', sa.UUID(), nullable=False),
        sa.Column('scope_description', sa.Text(), nullable=True),
        sa.Column('volume_limit', sa.Integer(), nullable=True),
        sa.Column('volume_unit', sa.String(length=20), nullable=True),
        sa.Column('sla_definition', sa.Text(), nullable=True),
        sa.Column('is_billable', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('valid_from', sa.Date(), nullable=False),
        sa.Column('valid_to', sa.Date(), nullable=True),
        sa.Column('additional_data', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], name=op.f('fk_contract_services_contract_id_contracts'), ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['service_id'], ['services.id'], name=op.f('fk_contract_services_service_id_services'), ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_contract_services')),
        sa.UniqueConstraint('contract_id', 'service_id', 'valid_from', name='uq_contract_service_valid_from'),
    )
    op.create_index('idx_cs_contract', 'contract_services', ['contract_id'], unique=False)
    op.create_index('idx_cs_service', 'contract_services', ['service_id'], unique=False)

    op.create_table('valorizations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('contract_id', sa.UUID(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('index_type', sa.String(length=20), nullable=False),
        sa.Column('index_value', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('planned_date', sa.Date(), nullable=False),
        sa.Column('applied_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(length=20), server_default=sa.text("'pending'"), nullable=False),
        sa.Column('approved_by', sa.UUID(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('additional_data', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.CheckConstraint("index_type IN ('GUS_CPI', 'fixed_pct', 'custom')", name=op.f('ck_valorizations_index_type_check')),
        sa.CheckConstraint("status IN ('pending', 'approved', 'applied', 'rejected')", name=op.f('ck_valorizations_status_check')),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id'], name=op.f('fk_valorizations_approved_by_users'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], name=op.f('fk_valorizations_contract_id_contracts'), ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_valorizations_created_by_users'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_valorizations')),
        sa.UniqueConstraint('contract_id', 'year', name='uq_valorization_contract_year'),
    )
    op.create_index('idx_val_contract_year', 'valorizations', ['contract_id', 'year'], unique=False)
    op.create_index('idx_val_status_planned', 'valorizations', ['status', 'planned_date'], unique=False)

    # ── Tier 4: attachments (break circular dep with contract_amendments) ─

    # Create attachments WITHOUT the amendment_id FK first
    op.create_table('attachments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('customer_id', sa.UUID(), nullable=True),
        sa.Column('contract_id', sa.UUID(), nullable=True),
        sa.Column('amendment_id', sa.UUID(), nullable=True),
        sa.Column('document_type', sa.String(length=50), nullable=False),
        sa.Column('original_filename', sa.String(length=500), nullable=False),
        sa.Column('s3_bucket', sa.String(length=255), nullable=False),
        sa.Column('s3_key', sa.String(length=1000), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=True),
        sa.Column('file_size_bytes', sa.BigInteger(), nullable=True),
        sa.Column('ocr_status', sa.String(length=20), server_default=sa.text("'pending'"), nullable=True),
        sa.Column('extracted_text', sa.Text(), nullable=True),
        sa.Column('extracted_fields', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column('version', sa.Integer(), server_default=sa.text('1'), nullable=False),
        sa.Column('uploaded_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.CheckConstraint("document_type IN ('contract', 'amendment', 'power_of_attorney', 'DPA', 'PPK', 'report', 'other')", name=op.f('ck_attachments_document_type_check')),
        sa.CheckConstraint("ocr_status IN ('pending', 'processing', 'done', 'failed', 'skipped')", name=op.f('ck_attachments_ocr_status_check')),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], name=op.f('fk_attachments_contract_id_contracts'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], name=op.f('fk_attachments_customer_id_customers'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], name=op.f('fk_attachments_uploaded_by_users'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_attachments')),
        sa.UniqueConstraint('s3_key', name=op.f('uq_attachments_s3_key')),
    )
    op.create_index('idx_att_contract', 'attachments', ['contract_id'], unique=False)
    op.create_index('idx_att_customer', 'attachments', ['customer_id'], unique=False)
    op.create_index('idx_att_ocr_status', 'attachments', ['ocr_status'], unique=False,
                    postgresql_where=sa.text("ocr_status IN ('pending', 'processing')"))

    # Now create contract_amendments (references attachments.id)
    op.create_table('contract_amendments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('contract_id', sa.UUID(), nullable=False),
        sa.Column('amendment_number', sa.String(length=50), nullable=False),
        sa.Column('amendment_date', sa.Date(), nullable=False),
        sa.Column('effective_date', sa.Date(), nullable=False),
        sa.Column('scope_of_change', sa.Text(), nullable=False),
        sa.Column('approved_by_client', sa.String(length=255), nullable=True),
        sa.Column('approved_by_hrk', sa.String(length=255), nullable=True),
        sa.Column('document_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], name=op.f('fk_contract_amendments_contract_id_contracts'), ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_contract_amendments_created_by_users'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['document_id'], ['attachments.id'], name=op.f('fk_contract_amendments_document_id_attachments'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_contract_amendments')),
        sa.UniqueConstraint('contract_id', 'amendment_number', name='uq_amendment_contract_number'),
    )

    # Now add the deferred FK: attachments.amendment_id → contract_amendments.id
    op.create_foreign_key(
        op.f('fk_attachments_amendment_id_contract_amendments'),
        'attachments', 'contract_amendments',
        ['amendment_id'], ['id'],
        ondelete='SET NULL',
    )

    op.create_table('document_chunks',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('attachment_id', sa.UUID(), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('token_count', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['attachment_id'], ['attachments.id'], name=op.f('fk_document_chunks_attachment_id_attachments'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_document_chunks')),
        sa.UniqueConstraint('attachment_id', 'chunk_index', name='uq_chunk_attachment_index'),
    )

    # ── Tier 5: depend on contract_services + valorizations ──────────────

    op.create_table('customer_rates',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('contract_service_id', sa.UUID(), nullable=False),
        sa.Column('valorization_id', sa.UUID(), nullable=True),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('net_price_01', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('net_price_02', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('net_price_03', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('net_price_04', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('net_price_05', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('net_price_06', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('net_price_07', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('net_price_08', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('net_price_09', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('net_price_10', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('net_price_11', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('net_price_12', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('base_price', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('discount_pct', sa.Numeric(precision=5, scale=2), server_default=sa.text('0.00'), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['contract_service_id'], ['contract_services.id'], name=op.f('fk_customer_rates_contract_service_id_contract_services'), ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_customer_rates_created_by_users'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['valorization_id'], ['valorizations.id'], name=op.f('fk_customer_rates_valorization_id_valorizations'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_customer_rates')),
        sa.UniqueConstraint('contract_service_id', 'year', name='uq_rate_cs_year'),
    )
    op.create_index('idx_rates_cs_year', 'customer_rates', ['contract_service_id', 'year'], unique=False)


def downgrade() -> None:
    """Revert migration."""
    op.drop_index('idx_rates_cs_year', table_name='customer_rates')
    op.drop_table('customer_rates')
    op.drop_table('document_chunks')
    op.drop_foreign_key(op.f('fk_attachments_amendment_id_contract_amendments'), 'attachments')
    op.drop_table('contract_amendments')
    op.drop_index('idx_att_ocr_status', table_name='attachments',
                   postgresql_where=sa.text("ocr_status IN ('pending', 'processing')"))
    op.drop_index('idx_att_customer', table_name='attachments')
    op.drop_index('idx_att_contract', table_name='attachments')
    op.drop_table('attachments')
    op.drop_index('idx_val_status_planned', table_name='valorizations')
    op.drop_index('idx_val_contract_year', table_name='valorizations')
    op.drop_table('valorizations')
    op.drop_index('idx_cs_service', table_name='contract_services')
    op.drop_index('idx_cs_contract', table_name='contract_services')
    op.drop_table('contract_services')
    op.drop_index('idx_notes_customer', table_name='notes')
    op.drop_index('idx_notes_contract', table_name='notes')
    op.drop_table('notes')
    op.drop_index('idx_alert_trigger_status', table_name='alerts')
    op.drop_index('idx_alert_customer', table_name='alerts')
    op.drop_index('idx_alert_assigned', table_name='alerts')
    op.drop_table('alerts')
    op.drop_index('idx_act_customer_date', table_name='activity_logs')
    op.drop_index('idx_act_contract', table_name='activity_logs')
    op.drop_table('activity_logs')
    op.drop_index('idx_score_customer_date', table_name='customer_relation_scores')
    op.drop_table('customer_relation_scores')
    op.drop_index('idx_contracts_number', table_name='contracts')
    op.drop_index('idx_contracts_end_date', table_name='contracts')
    op.drop_index('idx_contracts_deleted_at', table_name='contracts')
    op.drop_index('idx_contracts_customer_status', table_name='contracts')
    op.drop_table('contracts')
    op.drop_table('contact_persons')
    op.drop_table('services')
    op.drop_index('idx_audit_user', table_name='audit_logs')
    op.drop_index('idx_audit_entity', table_name='audit_logs')
    op.drop_index('idx_audit_created', table_name='audit_logs')
    op.drop_table('audit_logs')
    op.drop_index('idx_customers_status', table_name='customers')
    op.drop_index('idx_customers_deleted_at', table_name='customers')
    op.drop_index('idx_customers_ckk', table_name='customers')
    op.drop_index('idx_customers_ckd', table_name='customers')
    op.drop_index('idx_customers_account_manager', table_name='customers')
    op.drop_table('customers')
    op.drop_table('service_groups')
    op.drop_table('users')
    op.drop_table('companies')
