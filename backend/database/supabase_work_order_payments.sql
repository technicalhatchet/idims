-- Run in Supabase SQL Editor
-- Field-recorded work order payments (cash, check, etc.) with tax breakdown

CREATE TABLE IF NOT EXISTS work_order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  payment_number VARCHAR(50) NOT NULL UNIQUE,
  amount NUMERIC(10, 2) NOT NULL,
  subtotal_amount NUMERIC(10, 2),
  tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  tax_rate_snapshot NUMERIC(5, 4),
  payment_method payment_method_enum NOT NULL,
  reference_number VARCHAR(100),
  notes TEXT,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_work_order_payments_work_order_id
  ON work_order_payments (work_order_id);

CREATE INDEX IF NOT EXISTS ix_work_order_payments_payment_date
  ON work_order_payments (work_order_id, payment_date DESC);
