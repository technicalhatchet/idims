"""add dma_repair_records table

Revision ID: b7e4c2a91f05
Revises: f4a2b8c91d03
Create Date: 2026-05-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "b7e4c2a91f05"
down_revision = "f4a2b8c91d03"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "dma_repair_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("equipment_make", sa.String(120), nullable=True),
        sa.Column("equipment_model", sa.String(120), nullable=True),
        sa.Column("equipment_type", sa.String(50), nullable=True),
        sa.Column("equipment_subtype", sa.String(80), nullable=True),
        sa.Column("customer_complaint", sa.Text(), nullable=True),
        sa.Column("problem_code", sa.String(80), nullable=True),
        sa.Column("resolution_code", sa.String(80), nullable=True),
        sa.Column("confirmed_fix", sa.Text(), nullable=False),
        sa.Column("error_code_text", sa.String(80), nullable=True),
        sa.Column("replaced_parts", sa.Text(), nullable=True),
        sa.Column("repair_successful", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("callback_required", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("technician_summary", sa.Text(), nullable=True),
        sa.Column("performed_on", sa.Date(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_dma_repair_records_equipment_make", "dma_repair_records", ["equipment_make"])
    op.create_index("ix_dma_repair_records_equipment_subtype", "dma_repair_records", ["equipment_subtype"])
    op.create_index("ix_dma_repair_records_problem_code", "dma_repair_records", ["problem_code"])
    op.create_index("ix_dma_repair_records_resolution_code", "dma_repair_records", ["resolution_code"])
    op.create_index("ix_dma_repair_records_error_code_text", "dma_repair_records", ["error_code_text"])
    op.create_index("ix_dma_repair_records_repair_successful", "dma_repair_records", ["repair_successful"])
    op.create_index("ix_dma_repair_records_updated_at", "dma_repair_records", ["updated_at"])


def downgrade():
    op.drop_table("dma_repair_records")
