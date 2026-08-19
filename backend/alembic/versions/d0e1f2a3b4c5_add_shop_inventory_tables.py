"""add shop inventory tables

Revision ID: d0e1f2a3b4c5
Revises: c9d4e5f6a7b8
Create Date: 2026-08-19

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy import inspect

revision = "d0e1f2a3b4c5"
down_revision = "c9d4e5f6a7b8"
branch_labels = None
depends_on = None


def _table_names(bind):
    return set(inspect(bind).get_table_names())


def _column_names(bind, table):
    return {c["name"] for c in inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    tables = _table_names(bind)

    if "inventory_categories" not in tables:
        op.create_table(
            "inventory_categories",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        )

    if "inventory_items" not in tables:
        op.create_table(
            "inventory_items",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("category_id", UUID(as_uuid=True), sa.ForeignKey("inventory_categories.id", ondelete="SET NULL"), nullable=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("sku", sa.String(100), nullable=True, unique=True),
            sa.Column("unit_price", sa.Numeric(19, 4), nullable=False, server_default="0"),
            sa.Column("cost_price", sa.Numeric(19, 4), nullable=False, server_default="0"),
            sa.Column("quantity_in_stock", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("reorder_threshold", sa.Integer(), nullable=False, server_default="5"),
            sa.Column("location", sa.String(100), nullable=True),
            sa.Column("supplier_info", JSONB(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        )
        op.create_index("ix_inventory_items_category_active", "inventory_items", ["category_id", "is_active"])
    else:
        cols = _column_names(bind, "inventory_items")
        if "location" not in cols:
            op.add_column("inventory_items", sa.Column("location", sa.String(100), nullable=True))

    if "inventory_transactions" not in tables:
        op.create_table(
            "inventory_transactions",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("item_id", UUID(as_uuid=True), sa.ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False),
            sa.Column("transaction_type", sa.String(20), nullable=False),
            sa.Column("quantity", sa.Integer(), nullable=False),
            sa.Column("reference_id", UUID(as_uuid=True), nullable=True),
            sa.Column("reference_type", sa.String(50), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        )
        op.create_index("ix_inventory_transactions_item_id", "inventory_transactions", ["item_id"])

    # Seed default categories when empty
    op.execute(
        """
        INSERT INTO inventory_categories (id, name, description, created_at, updated_at)
        SELECT gen_random_uuid(), 'Van Stock', 'Parts kept on the service vehicle', NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM inventory_categories WHERE name = 'Van Stock');
        """
    )
    op.execute(
        """
        INSERT INTO inventory_categories (id, name, description, created_at, updated_at)
        SELECT gen_random_uuid(), 'Shop Stock', 'Parts in the shop / office', NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM inventory_categories WHERE name = 'Shop Stock');
        """
    )
    op.execute(
        """
        INSERT INTO inventory_categories (id, name, description, created_at, updated_at)
        SELECT gen_random_uuid(), 'Consumables', 'Fuses, tape, fasteners, etc.', NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM inventory_categories WHERE name = 'Consumables');
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    tables = _table_names(bind)
    if "inventory_transactions" in tables:
        op.drop_table("inventory_transactions")
    if "inventory_items" in tables:
        op.drop_index("ix_inventory_items_category_active", table_name="inventory_items")
        op.drop_table("inventory_items")
    if "inventory_categories" in tables:
        op.drop_table("inventory_categories")
