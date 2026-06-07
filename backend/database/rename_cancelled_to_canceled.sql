-- Standardize status spelling: cancelled → canceled (American English)
-- Run once against your Postgres database before or with the app deploy.
-- Appointments already use "canceled"; this fixes work orders, invoices, and text columns.

BEGIN;

-- 1. PostgreSQL enum types (RENAME VALUE requires Postgres 10+)
ALTER TYPE work_order_status_enum RENAME VALUE 'cancelled' TO 'canceled';
ALTER TYPE invoice_status_enum RENAME VALUE 'cancelled' TO 'canceled';

-- 2. Free-text status history (not enum-backed)
UPDATE work_order_status_history
SET previous_status = 'canceled'
WHERE previous_status = 'cancelled';

UPDATE work_order_status_history
SET new_status = 'canceled'
WHERE new_status = 'cancelled';

-- 3. Quotes use VARCHAR status (optional — only if you use cancelled on quotes)
UPDATE quotes
SET status = 'canceled'
WHERE status = 'cancelled';

COMMIT;

-- Verify (optional):
-- SELECT status, count(*) FROM work_orders WHERE status = 'canceled' GROUP BY 1;
-- SELECT status, count(*) FROM invoices WHERE status = 'canceled' GROUP BY 1;
