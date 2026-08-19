"""Add inventory link columns to work_order_parts

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-08-19

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import inspect

revision = "e1f2a3b4c5d6"
down_revision = "d0e1f2a3b4c5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    cols = {c["name"] for c in inspect(bind).get_columns("work_order_parts")}

    if "inventory_item_id" not in cols:
        op.add_column(
            "work_order_parts",
            sa.Column("inventory_item_id", UUID(as_uuid=True), nullable=True),
        )
        op.create_foreign_key(
            "fk_work_order_parts_inventory_item_id",
            "work_order_parts",
            "inventory_items",
            ["inventory_item_id"],
            ["id"],
            ondelete="SET NULL",
        )
        op.create_index(
            "ix_work_order_parts_inventory_item_id",
            "work_order_parts",
            ["inventory_item_id"],
        )

    if "inventory_consumed_qty" not in cols:
        op.add_column(
            "work_order_parts",
            sa.Column("inventory_consumed_qty", sa.Integer(), nullable=False, server_default="0"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    cols = {c["name"] for c in inspect(bind).get_columns("work_order_parts")}
    if "inventory_consumed_qty" in cols:
        op.drop_column("work_order_parts", "inventory_consumed_qty")
    if "inventory_item_id" in cols:
        op.drop_index("ix_work_order_parts_inventory_item_id", table_name="work_order_parts")
        op.drop_constraint("fk_work_order_parts_inventory_item_id", "work_order_parts", type_="foreignkey")
        op.drop_column("work_order_parts", "inventory_item_id")
