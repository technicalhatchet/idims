-- Undo 2026-10-21_portal_customer_invites.sql

BEGIN;

DROP INDEX IF EXISTS client_portal_claims_invited_by_login_id_idx;

ALTER TABLE client_portal_claims
  DROP COLUMN IF EXISTS invited_by_login_id;

COMMIT;
