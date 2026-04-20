"""Add equipment fields to WorkOrder model

Revision ID: b8f6e2c44602
Revises: 9d890e02bb7c
Create Date: 2025-04-10 00:24:31.525512

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8f6e2c44602'
down_revision: Union[str, None] = 'create_appointments_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add equipment fields to the work_orders table
    op.add_column('work_orders', sa.Column('equipment_make', sa.String(100), nullable=True))
    op.add_column('work_orders', sa.Column('equipment_model', sa.String(100), nullable=True))
    op.add_column('work_orders', sa.Column('equipment_serial', sa.String(100), nullable=True))
    op.add_column('work_orders', sa.Column('equipment_version', sa.String(100), nullable=True))


def downgrade() -> None:
    # Remove equipment fields from the work_orders table
    op.drop_column('work_orders', 'equipment_version')
    op.drop_column('work_orders', 'equipment_serial')
    op.drop_column('work_orders', 'equipment_model')
    op.drop_column('work_orders', 'equipment_make')
