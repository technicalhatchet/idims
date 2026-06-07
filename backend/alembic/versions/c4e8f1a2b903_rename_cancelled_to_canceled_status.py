"""rename cancelled to canceled on status enums

Revision ID: c4e8f1a2b903
Revises: db080cf6492
Create Date: 2026-05-21

"""
from typing import Sequence, Union

from alembic import op


revision: str = "c4e8f1a2b903"
down_revision: Union[str, None] = "db080cf6492"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE work_order_status_enum RENAME VALUE 'cancelled' TO 'canceled'")
    op.execute("ALTER TYPE invoice_status_enum RENAME VALUE 'cancelled' TO 'canceled'")
    op.execute(
        "UPDATE work_order_status_history SET previous_status = 'canceled' "
        "WHERE previous_status = 'cancelled'"
    )
    op.execute(
        "UPDATE work_order_status_history SET new_status = 'canceled' "
        "WHERE new_status = 'cancelled'"
    )
    op.execute("UPDATE quotes SET status = 'canceled' WHERE status = 'cancelled'")


def downgrade() -> None:
    op.execute("UPDATE quotes SET status = 'cancelled' WHERE status = 'canceled'")
    op.execute(
        "UPDATE work_order_status_history SET new_status = 'cancelled' "
        "WHERE new_status = 'canceled'"
    )
    op.execute(
        "UPDATE work_order_status_history SET previous_status = 'cancelled' "
        "WHERE previous_status = 'canceled'"
    )
    op.execute("ALTER TYPE invoice_status_enum RENAME VALUE 'canceled' TO 'cancelled'")
    op.execute("ALTER TYPE work_order_status_enum RENAME VALUE 'canceled' TO 'cancelled'")
