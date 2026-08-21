"""add dma standalone diagnostics and extend dma_repair_records

Revision ID: f7a8b9c0d1e2
Revises: a1b2c3d4e5f6
Create Date: 2026-08-20

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "f7a8b9c0d1e2"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "dma_repair_records",
        sa.Column("title", sa.String(200), nullable=True),
    )
    op.add_column(
        "dma_repair_records",
        sa.Column("equipment_serial", sa.String(120), nullable=True),
    )
    op.add_column(
        "dma_repair_records",
        sa.Column("context", sa.String(20), nullable=False, server_default="tech"),
    )
    op.add_column(
        "dma_repair_records",
        sa.Column("visibility", sa.String(32), nullable=False, server_default="private"),
    )
    op.add_column(
        "dma_repair_records",
        sa.Column("moderation_status", sa.String(20), nullable=False, server_default="approved"),
    )
    op.add_column(
        "dma_repair_records",
        sa.Column("imported_work_order_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_dma_repair_records_imported_work_order",
        "dma_repair_records",
        "work_orders",
        ["imported_work_order_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_dma_repair_records_context",
        "dma_repair_records",
        ["context"],
    )
    op.create_index(
        "ix_dma_repair_records_visibility",
        "dma_repair_records",
        ["visibility"],
    )
    op.create_index(
        "ix_dma_repair_records_moderation_status",
        "dma_repair_records",
        ["moderation_status"],
    )
    op.create_index(
        "ix_dma_repair_records_imported_work_order_id",
        "dma_repair_records",
        ["imported_work_order_id"],
    )

    op.create_table(
        "dma_standalone_diagnostics",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "outcome_id",
            UUID(as_uuid=True),
            sa.ForeignKey("dma_repair_records.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("equipment_make", sa.String(120), nullable=True),
        sa.Column("equipment_model", sa.String(120), nullable=True),
        sa.Column("equipment_type", sa.String(50), nullable=True),
        sa.Column("equipment_subtype", sa.String(80), nullable=True),
        sa.Column("equipment_serial", sa.String(120), nullable=True),
        sa.Column("customer_complaint", sa.Text(), nullable=True),
        sa.Column("payload", JSONB(), nullable=False),
        sa.Column("context", sa.String(20), nullable=False, server_default="tech"),
        sa.Column("visibility", sa.String(32), nullable=False, server_default="private"),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column(
            "imported_work_order_id",
            UUID(as_uuid=True),
            sa.ForeignKey("work_orders.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index(
        "ix_dma_standalone_diagnostics_outcome_id",
        "dma_standalone_diagnostics",
        ["outcome_id"],
    )
    op.create_index(
        "ix_dma_standalone_diagnostics_equipment_make",
        "dma_standalone_diagnostics",
        ["equipment_make"],
    )
    op.create_index(
        "ix_dma_standalone_diagnostics_equipment_subtype",
        "dma_standalone_diagnostics",
        ["equipment_subtype"],
    )
    op.create_index(
        "ix_dma_standalone_diagnostics_context",
        "dma_standalone_diagnostics",
        ["context"],
    )
    op.create_index(
        "ix_dma_standalone_diagnostics_created_by",
        "dma_standalone_diagnostics",
        ["created_by"],
    )
    op.create_index(
        "ix_dma_standalone_diagnostics_imported_work_order_id",
        "dma_standalone_diagnostics",
        ["imported_work_order_id"],
    )
    op.create_index(
        "ix_dma_standalone_diagnostics_updated_at",
        "dma_standalone_diagnostics",
        ["updated_at"],
    )


def downgrade():
    op.drop_table("dma_standalone_diagnostics")
    op.drop_constraint(
        "fk_dma_repair_records_imported_work_order",
        "dma_repair_records",
        type_="foreignkey",
    )
    op.drop_index("ix_dma_repair_records_imported_work_order_id", table_name="dma_repair_records")
    op.drop_index("ix_dma_repair_records_moderation_status", table_name="dma_repair_records")
    op.drop_index("ix_dma_repair_records_visibility", table_name="dma_repair_records")
    op.drop_index("ix_dma_repair_records_context", table_name="dma_repair_records")
    op.drop_column("dma_repair_records", "imported_work_order_id")
    op.drop_column("dma_repair_records", "moderation_status")
    op.drop_column("dma_repair_records", "visibility")
    op.drop_column("dma_repair_records", "context")
    op.drop_column("dma_repair_records", "equipment_serial")
    op.drop_column("dma_repair_records", "title")
