ALTER TABLE work_orders
  DROP CONSTRAINT IF EXISTS work_orders_diagnostic_credit_mode_check;

ALTER TABLE work_orders
  DROP COLUMN IF EXISTS diagnostic_credit_mode;
