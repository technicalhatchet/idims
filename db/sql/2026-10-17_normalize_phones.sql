-- Normalize clients.phone and clients.mobile to US E.164 (+1XXXXXXXXXX).
-- Prerequisite: review 2026-10-17_normalize_phones_preview.sql and fix audit failures.
-- Backup: backups.clients_phone_backup_20261017 (fails if that table already exists).
-- Date: 2026-10-17

CREATE SCHEMA IF NOT EXISTS backups;
REVOKE ALL ON SCHEMA backups FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA backups FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA backups
  REVOKE ALL ON TABLES FROM anon, authenticated;

BEGIN;

CREATE TABLE backups.clients_phone_backup_20261017 AS
SELECT
  id,
  phone,
  mobile,
  now() AT TIME ZONE 'utc' AS backed_up_at
FROM clients;

WITH base AS (
  SELECT
    id,
    phone,
    mobile,
    regexp_replace(COALESCE(phone, ''), '\D', '', 'g') AS phone_d,
    regexp_replace(COALESCE(mobile, ''), '\D', '', 'g') AS mobile_d
  FROM clients
),
calc AS (
  SELECT
    id,
    CASE
      WHEN phone IS NULL OR btrim(phone) = '' THEN NULL
      WHEN length(phone_d) = 10 THEN '+1' || phone_d
      WHEN length(phone_d) = 11 AND left(phone_d, 1) = '1' THEN '+1' || right(phone_d, 10)
      ELSE NULL
    END AS new_phone,
    CASE
      WHEN mobile IS NULL OR btrim(mobile) = '' THEN NULL
      WHEN length(mobile_d) = 10 THEN '+1' || mobile_d
      WHEN length(mobile_d) = 11 AND left(mobile_d, 1) = '1' THEN '+1' || right(mobile_d, 10)
      ELSE NULL
    END AS new_mobile
  FROM base
)
UPDATE clients c
SET
  phone = COALESCE(calc.new_phone, c.phone),
  mobile = COALESCE(calc.new_mobile, c.mobile)
FROM calc
WHERE c.id = calc.id
  AND (
    (calc.new_phone IS NOT NULL AND c.phone IS DISTINCT FROM calc.new_phone)
    OR (calc.new_mobile IS NOT NULL AND c.mobile IS DISTINCT FROM calc.new_mobile)
  );

WITH base AS (
  SELECT
    b.id,
    b.phone AS phone_before,
    b.mobile AS mobile_before,
    c.phone AS phone_after,
    c.mobile AS mobile_after
  FROM backups.clients_phone_backup_20261017 b
  JOIN clients c ON c.id = b.id
)
SELECT
  COUNT(*) FILTER (
    WHERE phone_before IS DISTINCT FROM phone_after
       OR mobile_before IS DISTINCT FROM mobile_after
  ) AS clients_with_any_phone_field_changed,
  COUNT(*) FILTER (WHERE phone_before IS DISTINCT FROM phone_after) AS phone_values_changed,
  COUNT(*) FILTER (WHERE mobile_before IS DISTINCT FROM mobile_after) AS mobile_values_changed
FROM base;

COMMIT;
