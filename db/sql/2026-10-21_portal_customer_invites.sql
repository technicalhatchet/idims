-- Phase 2g add-on: customer-initiated portal invites (who invited on claim).

BEGIN;

ALTER TABLE client_portal_claims
  ADD COLUMN IF NOT EXISTS invited_by_login_id uuid NULL
    REFERENCES client_logins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS client_portal_claims_invited_by_login_id_idx
  ON client_portal_claims (invited_by_login_id)
  WHERE invited_by_login_id IS NOT NULL;

COMMENT ON COLUMN client_portal_claims.invited_by_login_id IS
  'Active client_login that created this invite (customer self-service); NULL for staff invites.';

COMMIT;
