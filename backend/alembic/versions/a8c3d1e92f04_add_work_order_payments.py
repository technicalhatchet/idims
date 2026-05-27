"""add work_order_payments table

Revision ID: a8c3d1e92f04
Revises: f4a2b8c91d03
Create Date: 2026-05-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a8c3d1e92f04"
down_revision = "f4a2b8c91d03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "work_order_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("work_order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("work_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("payment_number", sa.String(50), nullable=False, unique=True),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("subtotal_amount", sa.Numeric(10, 2), nullable=True),
        sa.Column("tax_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("tax_rate_snapshot", sa.Numeric(5, 4), nullable=True),
        sa.Column(
            "payment_method",
            sa.Enum(
                "credit_card",
                "cash",
                "check",
                "bank_transfer",
                "paypal",
                "stripe",
                "other",
                name="payment_method_enum",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("reference_number", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("payment_date", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("recorded_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_work_order_payments_work_order_id", "work_order_payments", ["work_order_id"])


def downgrade() -> None:
    op.drop_table("work_order_payments")
