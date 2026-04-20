"""Update work order status enum

Revision ID: update_work_order_status_enum
Revises: cffe74267cd7
Create Date: 2023-08-13 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'update_work_order_status_enum'
down_revision = 'cffe74267cd7'
branch_labels = None
depends_on = None

old_enum = sa.Enum('pending', 'scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled',
                  name='work_order_status_enum')

new_enum = sa.Enum('pending', 'scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled',
                  'parts_on_order', 'reschedule', 'need_to_contact', 'redo',
                  name='work_order_status_enum')

def upgrade():
    # Create a temporary table without the enum constraint
    op.execute('ALTER TABLE work_orders ALTER COLUMN status TYPE VARCHAR(50)')
    
    # Drop the old enum type
    op.execute('DROP TYPE work_order_status_enum')
    
    # Create the new enum type
    op.execute("CREATE TYPE work_order_status_enum AS ENUM ('pending', 'scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled', 'parts_on_order', 'reschedule', 'need_to_contact', 'redo')")
    
    # Update the column to use the new enum type
    op.execute('ALTER TABLE work_orders ALTER COLUMN status TYPE work_order_status_enum USING status::work_order_status_enum')
    
    # Update the validation in schema files
    # Note: This doesn't actually modify the Python code files, 
    # you'll need to manually update the validation in schemas/work_order.py

def downgrade():
    # Create a temporary table without the enum constraint
    op.execute('ALTER TABLE work_orders ALTER COLUMN status TYPE VARCHAR(50)')
    
    # Drop the new enum type
    op.execute('DROP TYPE work_order_status_enum')
    
    # Create the old enum type
    op.execute("CREATE TYPE work_order_status_enum AS ENUM ('pending', 'scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled')")
    
    # Update the column to use the old enum type
    # Note: This might fail if any rows have values outside the old enum
    op.execute('ALTER TABLE work_orders ALTER COLUMN status TYPE work_order_status_enum USING status::work_order_status_enum') 