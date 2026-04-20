"""add_equipment_subtypes_and_parts

Revision ID: 053df206a265
Revises: b8f6e2c44602
Create Date: 2025-04-13 00:19:09.994188

"""
from typing import Sequence, Union
import logging

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine import reflection


# revision identifiers, used by Alembic.
revision: str = '053df206a265'
down_revision: Union[str, None] = 'b8f6e2c44602'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Set up logger
logger = logging.getLogger('alembic.runtime.migration')

def column_exists(table, column):
    """Check if a column exists in a table"""
    bind = op.get_bind()
    inspector = reflection.Inspector.from_engine(bind)
    columns = [c['name'] for c in inspector.get_columns(table)]
    return column in columns

def upgrade() -> None:
    try:
        # Add equipment type fields to work_orders table
        if not column_exists('work_orders', 'equipment_type'):
            logger.info("Adding equipment_type column...")
            op.add_column('work_orders', sa.Column('equipment_type', sa.String(50), nullable=True))
        else:
            logger.info("equipment_type column already exists, skipping...")
        
        if not column_exists('work_orders', 'equipment_subtype'):
            logger.info("Adding equipment_subtype column...")
            op.add_column('work_orders', sa.Column('equipment_subtype', sa.String(50), nullable=True))
        else:
            logger.info("equipment_subtype column already exists, skipping...")
        
        if not column_exists('work_orders', 'is_wall_mounted'):
            logger.info("Adding is_wall_mounted column...")
            op.add_column('work_orders', sa.Column('is_wall_mounted', sa.Boolean(), server_default='false', nullable=False))
        else:
            logger.info("is_wall_mounted column already exists, skipping...")
        
        if not column_exists('work_orders', 'equipment_notes'):
            logger.info("Adding equipment_notes column...")
            op.add_column('work_orders', sa.Column('equipment_notes', sa.Text(), nullable=True))
        else:
            logger.info("equipment_notes column already exists, skipping...")
        
        # Add vendor and tracking_number fields to work_order_parts table
        if not column_exists('work_order_parts', 'vendor'):
            logger.info("Adding vendor column to work_order_parts...")
            op.add_column('work_order_parts', sa.Column('vendor', sa.String(50), nullable=True))
        else:
            logger.info("vendor column already exists in work_order_parts, skipping...")
        
        if not column_exists('work_order_parts', 'tracking_number'):
            logger.info("Adding tracking_number column to work_order_parts...")
            op.add_column('work_order_parts', sa.Column('tracking_number', sa.String(100), nullable=True))
        else:
            logger.info("tracking_number column already exists in work_order_parts, skipping...")
        
    except Exception as e:
        logger.error(f"Error during migration: {str(e)}")
        raise


def downgrade() -> None:
    # For safety, the downgrade is a no-op
    logger.info("Downgrade is disabled for safety")
    pass
