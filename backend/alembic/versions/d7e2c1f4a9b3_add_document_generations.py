"""feat: document generations table

Revision ID: d7e2c1f4a9b3
Revises: b9813a3347a3
Create Date: 2026-05-14 09:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

revision = "d7e2c1f4a9b3"
down_revision = "b9813a3347a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_generations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=False),
        sa.Column("contract_id", sa.UUID(), nullable=True),
        sa.Column("amendment_id", sa.UUID(), nullable=True),
        sa.Column("attachment_pdf_id", sa.UUID(), nullable=True),
        sa.Column("cover_letter_attachment_id", sa.UUID(), nullable=True),
        sa.Column("template_key", sa.String(length=100), nullable=False),
        sa.Column("template_version", sa.String(length=20), nullable=False),
        sa.Column(
            "status",
            sa.String(length=32),
            server_default=sa.text("'draft'"),
            nullable=False,
        ),
        sa.Column(
            "payload",
            sa.dialects.postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "simulation",
            sa.dialects.postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "ai_artifacts",
            sa.dialects.postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("pdf_sha256", sa.String(length=64), nullable=True),
        sa.Column("generated_by", sa.UUID(), nullable=True),
        sa.Column("accepted_by", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["customer_id"], ["customers.id"], ondelete="CASCADE",
            name=op.f("fk_document_generations_customer_id_customers"),
        ),
        sa.ForeignKeyConstraint(
            ["contract_id"], ["contracts.id"], ondelete="SET NULL",
            name=op.f("fk_document_generations_contract_id_contracts"),
        ),
        sa.ForeignKeyConstraint(
            ["amendment_id"], ["contract_amendments.id"], ondelete="SET NULL",
            name=op.f("fk_document_generations_amendment_id_contract_amendments"),
        ),
        sa.ForeignKeyConstraint(
            ["attachment_pdf_id"], ["attachments.id"], ondelete="SET NULL",
            name=op.f("fk_document_generations_attachment_pdf_id_attachments"),
        ),
        sa.ForeignKeyConstraint(
            ["cover_letter_attachment_id"], ["attachments.id"], ondelete="SET NULL",
            name=op.f(
                "fk_document_generations_cover_letter_attachment_id_attachments"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["generated_by"], ["users.id"], ondelete="SET NULL",
            name=op.f("fk_document_generations_generated_by_users"),
        ),
        sa.ForeignKeyConstraint(
            ["accepted_by"], ["users.id"], ondelete="SET NULL",
            name=op.f("fk_document_generations_accepted_by_users"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_document_generations")),
    )
    op.create_index(
        "idx_doc_gen_customer", "document_generations", ["customer_id"], unique=False
    )
    op.create_index(
        "idx_doc_gen_contract", "document_generations", ["contract_id"], unique=False
    )
    op.create_index(
        "idx_doc_gen_status_created",
        "document_generations",
        ["status", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_doc_gen_status_created", table_name="document_generations")
    op.drop_index("idx_doc_gen_contract", table_name="document_generations")
    op.drop_index("idx_doc_gen_customer", table_name="document_generations")
    op.drop_table("document_generations")
