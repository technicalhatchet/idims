-- Allow evening on work_order_appointments.time_window
-- Run in Supabase SQL Editor after Phase 1 client_appliances migration

BEGIN;

ALTER TABLE work_order_appointments
  DROP CONSTRAINT IF EXISTS check_time_window_values;

ALTER TABLE work_order_appointments
  ADD CONSTRAINT check_time_window_values
  CHECK (time_window IS NULL OR time_window IN ('morning', 'afternoon', 'evening'));

COMMIT;

-- ROLLBACK:
-- ALTER TABLE work_order_appointments DROP CONSTRAINT IF EXISTS check_time_window_values;
-- ALTER TABLE work_order_appointments ADD CONSTRAINT check_time_window_values
--   CHECK (time_window IS NULL OR time_window IN ('morning', 'afternoon'));
