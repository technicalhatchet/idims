-- Function to handle invoice balances
CREATE OR REPLACE FUNCTION update_invoice_balance()
RETURNS TRIGGER AS $$
BEGIN
    NEW.balance = NEW.total - NEW.amount_paid;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for invoice balance updates
CREATE TRIGGER update_invoice_balance_trigger
BEFORE INSERT OR UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION update_invoice_balance();

-- Function to handle inventory adjustments on work order completion
CREATE OR REPLACE FUNCTION adjust_inventory_on_work_order_complete()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Reduce inventory for items used in this work order
        INSERT INTO inventory_transactions (
            item_id, 
            transaction_type, 
            quantity, 
            reference_id, 
            reference_type, 
            created_by
        )
        SELECT 
            woi.id, 
            'sale', 
            -woi.quantity, 
            NEW.id, 
            'work_order', 
            NEW.assigned_technician_id
        FROM work_order_items woi
        WHERE woi.work_order_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for work order completion inventory adjustments
CREATE TRIGGER adjust_inventory_on_work_order_complete_trigger
AFTER UPDATE ON work_orders
FOR EACH ROW
EXECUTE FUNCTION adjust_inventory_on_work_order_complete();

-- Function to handle inventory transactions for work orders
CREATE OR REPLACE FUNCTION process_work_order_inventory()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert inventory transactions for the work order items
    INSERT INTO inventory_transactions (
        item_id, 
        transaction_type, 
        quantity, 
        reference_id, 
        reference_type, 
        created_by
    )
    SELECT 
        woi.id, 
        'sale', 
        -woi.quantity, 
        NEW.id, 
        'work_order', 
        NEW.assigned_technician_id
    FROM work_order_items woi
    WHERE woi.work_order_id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for work order inventory processing
CREATE TRIGGER work_order_inventory_trigger
AFTER INSERT ON work_orders
FOR EACH ROW
EXECUTE FUNCTION process_work_order_inventory();