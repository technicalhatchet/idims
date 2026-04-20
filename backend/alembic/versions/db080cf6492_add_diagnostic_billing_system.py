"""Add diagnostic billing system

Revision ID: db080cf6492
Revises: fc10c1e3877a
Create Date: 2025-01-16 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'db080cf6492'
down_revision = 'fc10c1e3877a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add billing_status field to work_order_service table
    op.add_column('work_order_service', sa.Column('billing_status', sa.Enum(
        'not_billable', 'billable', 'paid', 'waived', 
        name='billing_status_enum'
    ), nullable=False, server_default='not_billable'))
    
    # Add payment tracking fields to work_orders table
    op.add_column('work_orders', sa.Column('amount_previously_paid', sa.Numeric(10, 2), nullable=False, server_default='0.00'))
    op.add_column('work_orders', sa.Column('diagnostic_discount_applied', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('work_orders', sa.Column('diagnostic_discount_amount', sa.Numeric(10, 2), nullable=True))
    
    # Update appointment_status_enum to include new statuses
    # First, convert to VARCHAR temporarily
    op.execute('ALTER TABLE work_order_appointments ALTER COLUMN status TYPE VARCHAR(50)')
    
    # Drop the old enum type
    op.execute('DROP TYPE appointment_status_enum')
    
    # Create the new enum type with additional statuses
    op.execute("""
        CREATE TYPE appointment_status_enum AS ENUM (
            'scheduled', 'reschedule', 'completed', 'canceled', 
            'phone_payment', 'refund'
        )
    """)
    
    # Convert back to enum type
    op.execute('ALTER TABLE work_order_appointments ALTER COLUMN status TYPE appointment_status_enum USING status::appointment_status_enum')
    
    # Add 'up_front' status to parts status field (this is currently a VARCHAR, so just add the value)
    # No changes needed for parts status as it's already VARCHAR
    
    # Create indexes for performance
    op.create_index('ix_work_order_service_billing_status', 'work_order_service', ['billing_status'])
    op.create_index('ix_work_orders_amount_paid', 'work_orders', ['amount_previously_paid'])


def downgrade() -> None:
    # Remove indexes
    op.drop_index('ix_work_orders_amount_paid', 'work_orders')
    op.drop_index('ix_work_order_service_billing_status', 'work_order_service')
    
    # Remove payment tracking fields from work_orders
    op.drop_column('work_orders', 'diagnostic_discount_amount')
    op.drop_column('work_orders', 'diagnostic_discount_applied')
    op.drop_column('work_orders', 'amount_previously_paid')
    
    # Remove billing_status from work_order_service
    op.drop_column('work_order_service', 'billing_status')
    
    # Revert appointment_status_enum to original values
    op.execute('ALTER TABLE work_order_appointments ALTER COLUMN status TYPE VARCHAR(50)')
    op.execute('DROP TYPE appointment_status_enum')
    op.execute("""
        CREATE TYPE appointment_status_enum AS ENUM (
            'scheduled', 'reschedule', 'completed', 'canceled'
        )
    """)
    op.execute('ALTER TABLE work_order_appointments ALTER COLUMN status TYPE appointment_status_enum USING status::appointment_status_enum')
    
    # Drop the billing_status_enum
    op.execute('DROP TYPE billing_status_enum')
