-- Undo 2026-10-17_client_appliance_verified.sql
-- Run ONLY after redeploying application code that does not reference verification columns.

BEGIN;

ALTER TABLE client_appliances DROP COLUMN IF EXISTS verified_by_user_id;
ALTER TABLE client_appliances DROP COLUMN IF EXISTS verified_by_staff_at;

COMMIT;
