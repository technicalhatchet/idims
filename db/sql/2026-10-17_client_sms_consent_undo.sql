-- Undo 2026-10-17_client_sms_consent.sql
-- Run ONLY after redeploying application code that does not reference sms_consent*.

BEGIN;

ALTER TABLE clients DROP COLUMN IF EXISTS sms_consent_source;
ALTER TABLE clients DROP COLUMN IF EXISTS sms_consent_at;
ALTER TABLE clients DROP COLUMN IF EXISTS sms_consent;

COMMIT;
