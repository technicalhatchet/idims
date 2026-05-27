"""add dma_repair_outcomes table

Revision ID: f4a2b8c91d03
Revises: fc10c1e3877a
Create Date: 2026-05-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "f4a2b8c91d03"
down_revision = "fc10c1e3877a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dma_repair_outcomes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("work_order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("work_orders.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("source_note_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("work_order_notes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("customer_complaint", sa.Text(), nullable=True),
        sa.Column("problem_code", sa.String(80), nullable=True),
        sa.Column("resolution_code", sa.String(80), nullable=True),
        sa.Column("confirmed_fix", sa.Text(), nullable=False),
        sa.Column("error_code_text", sa.String(80), nullable=True),
        sa.Column("replaced_parts", sa.Text(), nullable=True),
        sa.Column("repair_successful", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("callback_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("technician_summary", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_dma_repair_outcomes_work_order_id", "dma_repair_outcomes", ["work_order_id"])
    op.create_index("ix_dma_repair_outcomes_problem_code", "dma_repair_outcomes", ["problem_code"])
    op.create_index("ix_dma_repair_outcomes_resolution_code", "dma_repair_outcomes", ["resolution_code"])
    op.create_index("ix_dma_repair_outcomes_error_code_text", "dma_repair_outcomes", ["error_code_text"])
    op.create_index("ix_dma_repair_outcomes_repair_successful", "dma_repair_outcomes", ["repair_successful"])


def downgrade() -> None:
    op.drop_table("dma_repair_outcomes")
