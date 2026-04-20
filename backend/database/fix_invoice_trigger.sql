DROP TRIGGER IF EXISTS update_invoice_balance_trigger ON invoices;
DROP FUNCTION IF EXISTS update_invoice_balance();

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