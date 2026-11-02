-- Wave 3: tenant portal property scope + estimate auto-approve limits
BEGIN;

ALTER TABLE client_logins
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'owner';

ALTER TABLE client_logins
  DROP CONSTRAINT IF EXISTS client_logins_role_check;

ALTER TABLE client_logins
  ADD CONSTRAINT client_logins_role_check
  CHECK (role IN ('owner', 'tenant'));

COMMENT ON COLUMN client_logins.role IS
  'Portal login role: owner (full household) or tenant (property-scoped via client_login_property_access).';

CREATE TABLE IF NOT EXISTS client_login_property_access (
  client_login_id uuid NOT NULL REFERENCES client_logins(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_login_id, property_id)
);

CREATE INDEX IF NOT EXISTS client_login_property_access_property_id_idx
  ON client_login_property_access (property_id);

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS estimate_auto_approve_limit numeric(10, 2) NULL;

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS estimate_auto_approve_limit numeric(10, 2) NULL;

COMMENT ON COLUMN clients.estimate_auto_approve_limit IS
  'Default portal auto-approve repair estimate cap (NULL = always ask).';

COMMENT ON COLUMN properties.estimate_auto_approve_limit IS
  'Property override for auto-approve cap; when set, wins over client default.';

COMMIT;
