"""portal phase 4 scheduling fields

Revision ID: a1b2c3d4e5f6
Revises: f5a3c6d8e9f0
Create Date: 2026-07-06

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a1b2c3d4e5f6"
down_revision = "f5a3c6d8e9f0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "work_orders",
        sa.Column("service_tier", sa.String(20), nullable=True),
    )
    op.add_column(
        "work_orders",
        sa.Column("portal_scheduling_meta", postgresql.JSONB(), nullable=True),
    )

    op.add_column(
        "work_order_appointments",
        sa.Column("client_eta_narrowed_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "work_order_appointments",
        sa.Column("client_eta_start", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "work_order_appointments",
        sa.Column("client_eta_end", sa.DateTime(), nullable=True),
    )

    op.execute(
        """
        ALTER TABLE work_order_appointments
          DROP CONSTRAINT IF EXISTS check_time_window_values;
        """
    )
    op.execute(
        """
        ALTER TABLE work_order_appointments
          ADD CONSTRAINT check_time_window_values
          CHECK (time_window IS NULL OR time_window IN ('morning', 'afternoon', 'evening'));
        """
    )


def downgrade():
    op.execute(
        """
        ALTER TABLE work_order_appointments
          DROP CONSTRAINT IF EXISTS check_time_window_values;
        """
    )
    op.execute(
        """
        ALTER TABLE work_order_appointments
          ADD CONSTRAINT check_time_window_values
          CHECK (time_window IS NULL OR time_window IN ('morning', 'afternoon'));
        """
    )

    op.drop_column("work_order_appointments", "client_eta_end")
    op.drop_column("work_order_appointments", "client_eta_start")
    op.drop_column("work_order_appointments", "client_eta_narrowed_at")
    op.drop_column("work_orders", "portal_scheduling_meta")
    op.drop_column("work_orders", "service_tier")
