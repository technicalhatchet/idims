"""add part source and warranty fields to work_order_parts

Revision ID: d9f1a2b3c4e5
Revises: c4e8f1a2b903
Create Date: 2026-06-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d9f1a2b3c4e5"
down_revision: Union[str, None] = "c4e8f1a2b903"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "work_order_parts",
        sa.Column("part_source", sa.String(length=20), nullable=False, server_default="aftermarket"),
    )
    op.add_column(
        "work_order_parts",
        sa.Column("warranty_days_override", sa.Integer(), nullable=True),
    )
    op.add_column(
        "work_order_parts",
        sa.Column("installed_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "work_order_parts",
        sa.Column("warranty_expires_at", sa.DateTime(), nullable=True),
    )
    # Legacy installed rows: stamp install time; no auto warranty (aftermarket default).
    op.execute(
        """
        UPDATE work_order_parts
        SET installed_at = COALESCE(updated_at, created_at)
        WHERE status = 'installed' AND installed_at IS NULL
        """
    )
    op.alter_column("work_order_parts", "part_source", server_default=None)


def downgrade() -> None:
    op.drop_column("work_order_parts", "warranty_expires_at")
    op.drop_column("work_order_parts", "installed_at")
    op.drop_column("work_order_parts", "warranty_days_override")
    op.drop_column("work_order_parts", "part_source")
