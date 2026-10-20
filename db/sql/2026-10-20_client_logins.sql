-- Phase 2g: multiple portal logins per client (household / shared accounts).
-- Run after 2026-10-18_client_merge.sql (merged_into_client_id).

BEGIN;

CREATE TABLE IF NOT EXISTS client_logins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  auth0_user_id text NOT NULL,
  user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  display_name text NULL,
  invited_email text NULL,
  invited_phone text NULL,
  added_via text NOT NULL CHECK (
    added_via IN ('invite', 'email_match', 'self_signup', 'migrated')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS client_logins_auth0_user_id_active_unique
  ON client_logins (auth0_user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS client_logins_client_id_idx
  ON client_logins (client_id);

CREATE INDEX IF NOT EXISTS client_logins_client_id_active_idx
  ON client_logins (client_id)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE client_logins IS
  'Portal Auth0 subs linked to a client; source of truth for portal access (not clients.auth0_user_id).';

ALTER TABLE client_portal_claims
  ADD COLUMN IF NOT EXISTS invited_email text NULL,
  ADD COLUMN IF NOT EXISTS invited_phone text NULL,
  ADD COLUMN IF NOT EXISTS display_name text NULL;

-- Backfill one login per client that already has Auth0 linked.
INSERT INTO client_logins (
  client_id,
  auth0_user_id,
  user_id,
  added_via,
  created_at
)
SELECT
  c.id,
  c.auth0_user_id,
  COALESCE(u.id, c.user_id),
  'migrated',
  COALESCE(c.created_at, now())
FROM clients c
LEFT JOIN users u ON u.auth_id = c.auth0_user_id
WHERE c.auth0_user_id IS NOT NULL
  AND TRIM(c.auth0_user_id) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM client_logins cl WHERE cl.auth0_user_id = c.auth0_user_id
  );

COMMIT;

-- Verification (run after commit):
SELECT
  (SELECT COUNT(*) FROM clients WHERE auth0_user_id IS NOT NULL AND TRIM(auth0_user_id) <> '') AS clients_with_legacy_auth0,
  (SELECT COUNT(*) FROM client_logins WHERE added_via = 'migrated') AS migrated_logins,
  (SELECT COUNT(*) FROM client_logins WHERE revoked_at IS NULL) AS active_logins;
