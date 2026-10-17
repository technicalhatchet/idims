-- Add SMS consent columns to clients. Run BEFORE deploying contact-data app code.
-- Date: 2026-10-17
--
-- ============================================================================
-- LEGACY BOOKING CONSENT (for backfill decisions — do not guess)
-- ============================================================================
-- UI source: frontend/pages/book.js (communications consent checkbox)
-- Exact wording in production today:
--   "I agree to receive appointment updates from Atomic Repair by my selected
--    contact methods. SMS will be used when you choose text message and we have
--    your mobile number on file."
--
-- API storage: backend/app/routers/public.py sets custom_fields on the client:
--   - appointment_comms_consent_at  (ISO-8601 UTC string, set when booking submits)
--   - appointment_contact_primary   ("phone" | "email" | "sms")
--   - appointment_contact_backup    (optional, same enum)
--
-- Carrier / Twilio note:
--   This legacy text is general "contact methods" language. It does NOT include
--   "Msg & data rates may apply" or "Reply STOP to opt out." It should NOT be
--   treated as blanket sms_consent for every row with appointment_comms_consent_at.
--
-- This script:
--   1) Adds sms_consent* columns (default false).
--   2) Does NOT auto-set sms_consent = true from appointment_comms_consent_at alone.
--   3) Includes a PREVIEW query and an OPTIONAL backfill (commented) if legal later
--      approves mapping legacy SMS channel selection to sms_consent.
-- ============================================================================

BEGIN;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS sms_consent boolean NOT NULL DEFAULT false;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS sms_consent_at timestamptz NULL;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS sms_consent_source varchar(50) NULL;

COMMIT;

-- ---------------------------------------------------------------------------
-- Preview: legacy booking consent in custom_fields (read after COMMIT)
-- ---------------------------------------------------------------------------
SELECT
  COUNT(*) FILTER (
    WHERE custom_fields ? 'appointment_comms_consent_at'
      AND btrim(custom_fields->>'appointment_comms_consent_at') <> ''
  ) AS clients_with_legacy_comms_consent_at,
  COUNT(*) FILTER (
    WHERE custom_fields ? 'appointment_comms_consent_at'
      AND (
        custom_fields->>'appointment_contact_primary' = 'sms'
        OR custom_fields->>'appointment_contact_backup' = 'sms'
      )
  ) AS legacy_consent_with_sms_channel_selected,
  COUNT(*) FILTER (WHERE sms_consent = true) AS clients_sms_consent_true
FROM clients;

-- Rows that would match OPTIONAL booking_legacy backfill (SMS channel only)
SELECT
  id,
  email,
  mobile,
  phone,
  custom_fields->>'appointment_comms_consent_at' AS legacy_consent_at,
  custom_fields->>'appointment_contact_primary' AS contact_primary,
  custom_fields->>'appointment_contact_backup' AS contact_backup
FROM clients
WHERE custom_fields ? 'appointment_comms_consent_at'
  AND btrim(custom_fields->>'appointment_comms_consent_at') <> ''
  AND (
    custom_fields->>'appointment_contact_primary' = 'sms'
    OR custom_fields->>'appointment_contact_backup' = 'sms'
  )
ORDER BY updated_at DESC NULLS LAST;

/*
-- OPTIONAL — run only if legal confirms these rows may count as SMS opt-in.
-- Uses legacy timestamp and source 'booking_legacy'. Leaves all others false.

BEGIN;

UPDATE clients c
SET
  sms_consent = true,
  sms_consent_at = (c.custom_fields->>'appointment_comms_consent_at')::timestamptz,
  sms_consent_source = 'booking_legacy'
WHERE c.custom_fields ? 'appointment_comms_consent_at'
  AND btrim(c.custom_fields->>'appointment_comms_consent_at') <> ''
  AND (
    c.custom_fields->>'appointment_contact_primary' = 'sms'
    OR c.custom_fields->>'appointment_contact_backup' = 'sms'
  )
  AND c.sms_consent = false;

COMMIT;
*/
