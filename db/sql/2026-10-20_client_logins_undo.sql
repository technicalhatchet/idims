-- Undo Phase 2g client_logins (portal code must be rolled back first).

BEGIN;

ALTER TABLE client_portal_claims
  DROP COLUMN IF EXISTS invited_email,
  DROP COLUMN IF EXISTS invited_phone,
  DROP COLUMN IF EXISTS display_name;

DROP TABLE IF EXISTS client_logins;

COMMIT;
