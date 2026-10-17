-- DB-backed single-use portal claim tokens (invite links, email change, etc.).
-- Run BEFORE deploying API code that reads client_portal_claims.
-- Date: 2026-10-17

BEGIN;

CREATE TABLE IF NOT EXISTS client_portal_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL,
  purpose varchar(50) NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  created_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NULL,
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS client_portal_claims_token_hash_idx
  ON client_portal_claims (token_hash);

CREATE INDEX IF NOT EXISTS client_portal_claims_client_active_idx
  ON client_portal_claims (client_id, used_at)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE client_portal_claims IS
  'Single-use portal registration / email-change tokens (store SHA-256 hash only).';

COMMIT;
