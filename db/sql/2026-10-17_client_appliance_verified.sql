-- Staff verification on client appliance registry (portal source labels).
-- Run BEFORE deploying app code that reads verified_by_staff_at / verified_by_user_id.
-- Date: 2026-10-17

BEGIN;

ALTER TABLE client_appliances
  ADD COLUMN IF NOT EXISTS verified_by_staff_at timestamptz NULL;

ALTER TABLE client_appliances
  ADD COLUMN IF NOT EXISTS verified_by_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN client_appliances.verified_by_staff_at IS
  'When set, portal shows Verified by Atomic Repair without changing source.';

COMMENT ON COLUMN client_appliances.verified_by_user_id IS
  'Staff user who verified the appliance record.';

-- Legacy staff-entered rows: treat as verified for display (source unchanged).
UPDATE client_appliances
SET verified_by_staff_at = COALESCE(updated_at, created_at, NOW() AT TIME ZONE 'utc')
WHERE verified_by_staff_at IS NULL
  AND source IN ('staff', 'manual');

COMMIT;
