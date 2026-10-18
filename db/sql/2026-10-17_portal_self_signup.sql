-- Portal open sign-up: profile completion timestamp on clients.
-- Run BEFORE deploying phase 2c API that reads portal_profile_completed_at.
-- Date: 2026-10-17

-- STEP 0 (read-only): run this alone first. Fix any duplicate auth0_user_id rows before the unique index.
-- SELECT auth0_user_id, COUNT(*) AS n, array_agg(id ORDER BY created_at) AS client_ids
-- FROM clients
-- WHERE auth0_user_id IS NOT NULL
-- GROUP BY auth0_user_id
-- HAVING COUNT(*) > 1;

BEGIN;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS portal_profile_completed_at timestamptz NULL;

COMMENT ON COLUMN clients.portal_profile_completed_at IS
  'Set when a self_signup portal user finishes the finish-profile step (Auth0 client role assigned after).';

CREATE INDEX IF NOT EXISTS clients_source_idx ON clients (source);

CREATE UNIQUE INDEX IF NOT EXISTS clients_auth0_user_id_unique
  ON clients (auth0_user_id)
  WHERE auth0_user_id IS NOT NULL;

COMMIT;
