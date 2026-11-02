-- Undo Wave 3 tenant scope + estimate auto-approve limits
BEGIN;

ALTER TABLE properties DROP COLUMN IF EXISTS estimate_auto_approve_limit;
ALTER TABLE clients DROP COLUMN IF EXISTS estimate_auto_approve_limit;

DROP TABLE IF EXISTS client_login_property_access;

ALTER TABLE client_logins DROP CONSTRAINT IF EXISTS client_logins_role_check;
ALTER TABLE client_logins DROP COLUMN IF EXISTS role;

COMMIT;
