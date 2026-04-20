import os
import sqlite3
from sqlalchemy import create_engine, text

def run_migration():
    # Create engine
    engine = create_engine('sqlite:///./idims.db')
    
    # Execute the migration manually since alembic is having issues
    with engine.connect() as conn:
        # Add billing_status column to work_order_service table
        try:
            conn.execute(text("ALTER TABLE work_order_service ADD COLUMN billing_status VARCHAR(20) DEFAULT 'not_billable'"))
            print('Added billing_status column to work_order_service')
        except Exception as e:
            print(f'billing_status column may already exist: {e}')
        
        # Add payment tracking columns to work_orders table
        try:
            conn.execute(text('ALTER TABLE work_orders ADD COLUMN amount_previously_paid DECIMAL(10,2) DEFAULT 0.00'))
            print('Added amount_previously_paid column to work_orders')
        except Exception as e:
            print(f'amount_previously_paid column may already exist: {e}')
        
        try:
            conn.execute(text('ALTER TABLE work_orders ADD COLUMN diagnostic_discount_applied BOOLEAN DEFAULT 0'))
            print('Added diagnostic_discount_applied column to work_orders')
        except Exception as e:
            print(f'diagnostic_discount_applied column may already exist: {e}')
        
        try:
            conn.execute(text('ALTER TABLE work_orders ADD COLUMN diagnostic_discount_amount DECIMAL(10,2)'))
            print('Added diagnostic_discount_amount column to work_orders')
        except Exception as e:
            print(f'diagnostic_discount_amount column may already exist: {e}')
        
        conn.commit()
        print('Database migration completed successfully!')

if __name__ == "__main__":
    run_migration()
