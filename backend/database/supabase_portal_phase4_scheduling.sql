-- Portal Phase 4: same-day scheduling meta, narrowed ETA columns, evening time_window
-- Run in Supabase SQL Editor after client_appliances migration

BEGIN;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS service_tier VARCHAR(20),
  ADD COLUMN IF NOT EXISTS portal_scheduling_meta JSONB;

ALTER TABLE work_order_appointments
  ADD COLUMN IF NOT EXISTS client_eta_narrowed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_eta_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_eta_end TIMESTAMPTZ;

ALTER TABLE work_order_appointments
  DROP CONSTRAINT IF EXISTS check_time_window_values;

ALTER TABLE work_order_appointments
  ADD CONSTRAINT check_time_window_values
  CHECK (time_window IS NULL OR time_window IN ('morning', 'afternoon', 'evening'));

COMMIT;
