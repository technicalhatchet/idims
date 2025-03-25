-- Fix 1: Add missing foreign key constraints (if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_work_order_status_history_changed_by'
    ) THEN
        ALTER TABLE work_order_status_history
        ADD CONSTRAINT fk_work_order_status_history_changed_by
        FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_inventory_transactions_created_by'
    ) THEN
        ALTER TABLE inventory_transactions
        DROP CONSTRAINT IF EXISTS inventory_transactions_created_by_fkey,
        ADD CONSTRAINT fk_inventory_transactions_created_by
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

ALTER TABLE inventory_transactions
ADD CONSTRAINT fk_inventory_transactions_reference
FOREIGN KEY (reference_id, reference_type) REFERENCES work_orders(id, 'work_order')
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- Fix 2: Add optimized indices for common queries (IF NOT EXISTS is already handled)
CREATE INDEX IF NOT EXISTS idx_work_orders_client_status ON work_orders(client_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_client_status ON invoices(client_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category_active ON inventory_items(category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_work_order_assigned_status ON work_orders(assigned_technician_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_status ON payments(invoice_id, status);

-- Fix 3: Standardize default values for status fields
DO $$ 
BEGIN
    -- Work Orders status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'work_orders' 
        AND column_name = 'status' 
        AND column_default = '''pending'''::text
    ) THEN
        ALTER TABLE work_orders 
        ALTER COLUMN status SET DEFAULT 'pending',
        ALTER COLUMN status SET NOT NULL;
    END IF;

    -- Invoices status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'status' 
        AND column_default = '''draft'''::text
    ) THEN
        ALTER TABLE invoices
        ALTER COLUMN status SET DEFAULT 'draft',
        ALTER COLUMN status SET NOT NULL;
    END IF;
END $$;

ALTER TABLE quotes
ALTER COLUMN status SET DEFAULT 'draft',
ALTER COLUMN status SET NOT NULL;

ALTER TABLE payments
ALTER COLUMN status SET DEFAULT 'pending',
ALTER COLUMN status SET NOT NULL;

-- Fix 4: Update timestamp triggers for all tables with updated_at
-- Create the triggers for all tables with updated_at columns
DO $$
DECLARE
    tables CURSOR FOR
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = pg_tables.tablename
            AND column_name = 'updated_at'
        );
BEGIN
    FOR table_record IN tables LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%s_modtime ON %I;
            CREATE TRIGGER update_%s_modtime
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ', table_record.tablename, table_record.tablename, table_record.tablename, table_record.tablename);
    END LOOP;
END
$$;

-- Fix 5: Update data types for better flexibility
ALTER TABLE clients 
ALTER COLUMN notes TYPE TEXT,
ALTER COLUMN address_line1 TYPE TEXT,
ALTER COLUMN address_line2 TYPE TEXT;

ALTER TABLE work_orders
ALTER COLUMN description TYPE TEXT;

ALTER TABLE invoices
ALTER COLUMN notes TYPE TEXT,
ALTER COLUMN terms TYPE TEXT;

-- Use NUMERIC(19,4) for all money-related columns
ALTER TABLE inventory_items
ALTER COLUMN unit_price TYPE NUMERIC(19,4),
ALTER COLUMN cost_price TYPE NUMERIC(19,4);

ALTER TABLE work_order_services
ALTER COLUMN price TYPE NUMERIC(19,4);

ALTER TABLE work_order_items
ALTER COLUMN price TYPE NUMERIC(19,4);

ALTER TABLE invoices
ALTER COLUMN subtotal TYPE NUMERIC(19,4),
ALTER COLUMN tax_amount TYPE NUMERIC(19,4),
ALTER COLUMN discount_amount TYPE NUMERIC(19,4),
ALTER COLUMN total_amount TYPE NUMERIC(19,4),
ALTER COLUMN amount_paid TYPE NUMERIC(19,4),
ALTER COLUMN balance TYPE NUMERIC(19,4);

ALTER TABLE invoice_items
ALTER COLUMN unit_price TYPE NUMERIC(19,4),
ALTER COLUMN total TYPE NUMERIC(19,4);

ALTER TABLE payments
ALTER COLUMN amount TYPE NUMERIC(19,4);

-- Fix 6: Add stricter data validation constraints
ALTER TABLE users
ADD CONSTRAINT email_format_check CHECK (email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$');

ALTER TABLE clients
ADD CONSTRAINT postal_code_format_check CHECK (postal_code ~* '^\d{5}(-\d{4})?$');

-- Fix 7: Add better index for location-based queries
DROP INDEX IF EXISTS idx_clients_location;
CREATE INDEX idx_clients_location ON clients USING GIST (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

DROP INDEX IF EXISTS idx_technicians_location;
CREATE INDEX idx_technicians_location ON technicians USING GIST (
    ST_SetSRID(ST_MakePoint(current_longitude, current_latitude), 4326)
) WHERE current_latitude IS NOT NULL AND current_longitude IS NOT NULL;

-- Fix 8: Add timestamp for successful deliveries in notifications
ALTER TABLE notifications
ADD COLUMN delivered_at TIMESTAMPTZ;

-- Fix 9: Improve work order search
CREATE INDEX idx_work_orders_fulltext ON work_orders 
USING GIN (to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Fix 10: Add constraints to ensure end times are after start times
ALTER TABLE work_orders
ADD CONSTRAINT work_order_time_check 
CHECK (scheduled_end IS NULL OR scheduled_end > scheduled_start);

ALTER TABLE technician_time_off
ADD CONSTRAINT time_off_period_check 
CHECK (end_date > start_date);

-- Fix 11: Add PostgreSQL extensions for better functionality
DO $$ 
BEGIN
    CREATE EXTENSION IF NOT EXISTS postgis;
EXCEPTION
    WHEN undefined_file OR insufficient_privilege THEN
        RAISE NOTICE 'PostGIS extension is not available. Skipping spatial features.';
END $$;

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Fix 12: Add isolation level for inventory transactions
ALTER TABLE inventory_transactions
ADD COLUMN isolation_level VARCHAR(20) DEFAULT 'read_committed';

-- Fix 13: Create a view to simplify common client queries
CREATE OR REPLACE VIEW client_summary AS
SELECT 
    c.id,
    c.company_name,
    COALESCE(u.first_name || ' ' || u.last_name, 'No User') AS contact_name,
    u.email,
    u.phone,
    c.address_line1,
    c.city,
    c.state,
    c.postal_code,
    COUNT(DISTINCT wo.id) AS total_work_orders,
    COUNT(DISTINCT inv.id) AS total_invoices,
    COALESCE(SUM(inv.total_amount), 0) AS total_billed,
    COALESCE(SUM(inv.amount_paid), 0) AS total_paid,
    MAX(wo.created_at) AS last_service_date
FROM 
    clients c
LEFT JOIN 
    users u ON c.user_id = u.id
LEFT JOIN 
    work_orders wo ON c.id = wo.client_id
LEFT JOIN 
    invoices inv ON c.id = inv.client_id
GROUP BY 
    c.id, c.company_name, u.first_name, u.last_name, u.email, u.phone, 
    c.address_line1, c.city, c.state, c.postal_code;

-- Fix 14: Add database functions to encapsulate complex operations
CREATE OR REPLACE FUNCTION complete_work_order(
    p_work_order_id UUID,
    p_user_id UUID
) RETURNS VOID AS $$
DECLARE
    v_previous_status VARCHAR(20);
BEGIN
    -- Get the current status
    SELECT status INTO v_previous_status FROM work_orders WHERE id = p_work_order_id;
    
    -- Update work order
    UPDATE work_orders 
    SET 
        status = 'completed', 
        actual_end = NOW()
    WHERE 
        id = p_work_order_id;
    
    -- Add status history
    INSERT INTO work_order_status_history (
        work_order_id, 
        previous_status, 
        new_status, 
        changed_by
    ) VALUES (
        p_work_order_id,
        v_previous_status,
        'completed',
        p_user_id
    );
END;
$$ LANGUAGE plpgsql;

-- Fix 15: Add database level audit logging functionality
CREATE OR REPLACE FUNCTION audit_trigger_function() 
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (entity_type, entity_id, action, new_values, user_id)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW)::jsonb, NEW.updated_by);
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (entity_type, entity_id, action, old_values, new_values, user_id)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, NEW.updated_by);
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (entity_type, entity_id, action, old_values, user_id)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD)::jsonb, OLD.updated_by);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop the old audit_log table if it exists
DROP TABLE IF EXISTS audit_log;

-- Fix 16: Create audit triggers if they don't exist
DO $$ 
BEGIN
    -- Work Orders audit trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'audit_work_orders'
    ) THEN
        CREATE TRIGGER audit_work_orders
        AFTER INSERT OR UPDATE OR DELETE ON work_orders
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
    END IF;

    -- Invoices audit trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'audit_invoices'
    ) THEN
        CREATE TRIGGER audit_invoices
        AFTER INSERT OR UPDATE OR DELETE ON invoices
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
    END IF;

    -- Clients audit trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'audit_clients'
    ) THEN
        CREATE TRIGGER audit_clients
        AFTER INSERT OR UPDATE OR DELETE ON clients
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
    END IF;

    -- Inventory Items audit trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'audit_inventory_items'
    ) THEN
        CREATE TRIGGER audit_inventory_items
        AFTER INSERT OR UPDATE OR DELETE ON inventory_items
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
    END IF;

    -- Payments audit trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'audit_payments'
    ) THEN
        CREATE TRIGGER audit_payments
        AFTER INSERT OR UPDATE OR DELETE ON payments
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
    END IF;
END $$;

-- Fix 17: Create materialized view for reporting
CREATE MATERIALIZED VIEW monthly_revenue AS
SELECT
    date_trunc('month', invoices.issue_date) AS month,
    COUNT(DISTINCT invoices.id) AS invoice_count,
    SUM(invoices.total) AS total_revenue,
    SUM(invoices.amount_paid) AS total_collected,
    SUM(invoices.total - invoices.amount_paid) AS total_outstanding,
    COUNT(DISTINCT invoices.client_id) AS unique_clients,
    COUNT(DISTINCT invoices.work_order_id) AS completed_jobs
FROM
    invoices
GROUP BY
    date_trunc('month', invoices.issue_date)
ORDER BY
    month;

-- Create index on the materialized view
CREATE UNIQUE INDEX monthly_revenue_month_idx ON monthly_revenue (month);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_monthly_revenue()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW monthly_revenue;
END;
$$ LANGUAGE plpgsql;

-- Create function to handle invoice balances
CREATE OR REPLACE FUNCTION update_invoice_balance()
RETURNS TRIGGER AS $$
BEGIN
    NEW.balance = NEW.total - NEW.amount_paid;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_invoice_balance_trigger
BEFORE INSERT OR UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION update_invoice_balance();
