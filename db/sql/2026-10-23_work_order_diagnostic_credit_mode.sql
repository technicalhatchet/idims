-- Per-WO diagnostic credit: half (50% rounded up to whole $) or full (100%)
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS diagnostic_credit_mode VARCHAR(8);

UPDATE work_orders
SET diagnostic_credit_mode = 'full'
WHERE diagnostic_credit_mode IS NULL;

ALTER TABLE work_orders
  ALTER COLUMN diagnostic_credit_mode SET DEFAULT 'half';

ALTER TABLE work_orders
  ALTER COLUMN diagnostic_credit_mode SET NOT NULL;

ALTER TABLE work_orders
  DROP CONSTRAINT IF EXISTS work_orders_diagnostic_credit_mode_check;

ALTER TABLE work_orders
  ADD CONSTRAINT work_orders_diagnostic_credit_mode_check
  CHECK (diagnostic_credit_mode IN ('half', 'full'));
