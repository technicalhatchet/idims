-- Pay links (/pay/{token}) — Square plan option A, 2026-11-04.
-- Run in Supabase (test DB first, then prod) BEFORE deploying the backend:
-- the WorkOrder model now selects pay_token, so every work order query fails until it exists.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS pay_token TEXT
    DEFAULT encode(gen_random_bytes(24), 'hex');

UPDATE work_orders
SET pay_token = encode(gen_random_bytes(24), 'hex')
WHERE pay_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ix_work_orders_pay_token
  ON work_orders (pay_token);
