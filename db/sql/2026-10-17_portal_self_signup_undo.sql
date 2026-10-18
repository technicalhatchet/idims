-- Undo: portal self-signup column (run only after redeploying app without 2c code).
-- Date: 2026-10-17

BEGIN;

DROP INDEX IF EXISTS clients_auth0_user_id_unique;
DROP INDEX IF EXISTS clients_source_idx;

ALTER TABLE clients
  DROP COLUMN IF EXISTS portal_profile_completed_at;

COMMIT;
