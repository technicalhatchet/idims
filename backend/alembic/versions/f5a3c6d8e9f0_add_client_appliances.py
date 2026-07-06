"""add client_appliances and portal scheduling flags

Revision ID: f5a3c6d8e9f0
Revises: e1f2a3b4c5d6
Create Date: 2026-07-06

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "f5a3c6d8e9f0"
down_revision = "e1f2a3b4c5d6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "client_appliances",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("property_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="SET NULL"), nullable=True),
        sa.Column("nickname", sa.String(120), nullable=True),
        sa.Column("equipment_type", sa.String(50), nullable=False),
        sa.Column("equipment_subtype", sa.String(50), nullable=True),
        sa.Column("make", sa.String(100), nullable=True),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("serial", sa.String(100), nullable=True),
        sa.Column("equipment_version", sa.String(100), nullable=True),
        sa.Column("is_wall_mounted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("photo_urls", postgresql.JSONB(), nullable=True),
        sa.Column("source", sa.String(30), nullable=False, server_default="manual"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("merged_into_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("client_appliances.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_client_appliances_client_id", "client_appliances", ["client_id"])
    op.create_index("ix_client_appliances_property_id", "client_appliances", ["property_id"])

    op.add_column(
        "work_orders",
        sa.Column("appliance_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("client_appliances.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_work_orders_appliance_id", "work_orders", ["appliance_id"])

    op.add_column(
        "clients",
        sa.Column("self_scheduling_blocked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "clients",
        sa.Column("appliances_import_completed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade():
    op.drop_column("clients", "appliances_import_completed")
    op.drop_column("clients", "self_scheduling_blocked")
    op.drop_index("ix_work_orders_appliance_id", table_name="work_orders")
    op.drop_column("work_orders", "appliance_id")
    op.drop_index("ix_client_appliances_property_id", table_name="client_appliances")
    op.drop_index("ix_client_appliances_client_id", table_name="client_appliances")
    op.drop_table("client_appliances")
