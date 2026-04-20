-- Drop existing data in reverse order of dependencies
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE work_order_status_history CASCADE;
TRUNCATE TABLE work_order_notes CASCADE;
TRUNCATE TABLE work_order_items CASCADE;
TRUNCATE TABLE inventory_transactions CASCADE;
TRUNCATE TABLE payments CASCADE;
TRUNCATE TABLE invoices CASCADE;
TRUNCATE TABLE work_orders CASCADE;
TRUNCATE TABLE technicians CASCADE;
TRUNCATE TABLE clients CASCADE;
TRUNCATE TABLE users CASCADE; 