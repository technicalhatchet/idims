-- Restore clients.phone / clients.mobile from backups.clients_phone_backup_20261017
-- only when the live value still matches what the forward migration produced.
-- Run ONLY after redeploying prior app code if needed.
-- Last result set: rows skipped because phone/mobile was edited after migration.
-- Date: 2026-10-17

BEGIN;

WITH backup AS (
  SELECT
    b.id,
    b.phone AS backup_phone,
    b.mobile AS backup_mobile,
    regexp_replace(COALESCE(b.phone, ''), '\D', '', 'g') AS phone_d,
    regexp_replace(COALESCE(b.mobile, ''), '\D', '', 'g') AS mobile_d
  FROM backups.clients_phone_backup_20261017 b
),
expected AS (
  SELECT
    id,
    backup_phone,
    backup_mobile,
    CASE
      WHEN backup_phone IS NULL OR btrim(backup_phone) = '' THEN NULL
      WHEN length(phone_d) = 10 THEN '+1' || phone_d
      WHEN length(phone_d) = 11 AND left(phone_d, 1) = '1' THEN '+1' || right(phone_d, 10)
      ELSE backup_phone
    END AS expected_phone,
    CASE
      WHEN backup_mobile IS NULL OR btrim(backup_mobile) = '' THEN NULL
      WHEN length(mobile_d) = 10 THEN '+1' || mobile_d
      WHEN length(mobile_d) = 11 AND left(mobile_d, 1) = '1' THEN '+1' || right(mobile_d, 10)
      ELSE backup_mobile
    END AS expected_mobile
  FROM backup
),
flags AS (
  SELECT
    e.id,
    e.backup_phone,
    e.backup_mobile,
    e.expected_phone,
    e.expected_mobile,
    c.phone AS current_phone,
    c.mobile AS current_mobile,
    (c.phone IS NOT DISTINCT FROM e.expected_phone) AS phone_restore_ok,
    (c.mobile IS NOT DISTINCT FROM e.expected_mobile) AS mobile_restore_ok
  FROM expected e
  JOIN clients c ON c.id = e.id
)
UPDATE clients c
SET
  phone = CASE WHEN f.phone_restore_ok THEN f.backup_phone ELSE c.phone END,
  mobile = CASE WHEN f.mobile_restore_ok THEN f.backup_mobile ELSE c.mobile END
FROM flags f
WHERE c.id = f.id
  AND (f.phone_restore_ok OR f.mobile_restore_ok);

COMMIT;

WITH backup AS (
  SELECT
    b.id,
    b.phone AS backup_phone,
    b.mobile AS backup_mobile,
    regexp_replace(COALESCE(b.phone, ''), '\D', '', 'g') AS phone_d,
    regexp_replace(COALESCE(b.mobile, ''), '\D', '', 'g') AS mobile_d
  FROM backups.clients_phone_backup_20261017 b
),
expected AS (
  SELECT
    id,
    backup_phone,
    backup_mobile,
    CASE
      WHEN backup_phone IS NULL OR btrim(backup_phone) = '' THEN NULL
      WHEN length(phone_d) = 10 THEN '+1' || phone_d
      WHEN length(phone_d) = 11 AND left(phone_d, 1) = '1' THEN '+1' || right(phone_d, 10)
      ELSE backup_phone
    END AS expected_phone,
    CASE
      WHEN backup_mobile IS NULL OR btrim(backup_mobile) = '' THEN NULL
      WHEN length(mobile_d) = 10 THEN '+1' || mobile_d
      WHEN length(mobile_d) = 11 AND left(mobile_d, 1) = '1' THEN '+1' || right(mobile_d, 10)
      ELSE backup_mobile
    END AS expected_mobile
  FROM backup
)
SELECT
  e.id,
  c.first_name,
  c.last_name,
  c.phone AS current_phone,
  e.expected_phone,
  e.backup_phone,
  c.mobile AS current_mobile,
  e.expected_mobile,
  e.backup_mobile,
  CASE
    WHEN c.phone IS NOT DISTINCT FROM e.expected_phone THEN NULL
    ELSE 'phone edited since migration'
  END AS phone_skip_reason,
  CASE
    WHEN c.mobile IS NOT DISTINCT FROM e.expected_mobile THEN NULL
    ELSE 'mobile edited since migration'
  END AS mobile_skip_reason
FROM expected e
JOIN clients c ON c.id = e.id
WHERE c.phone IS DISTINCT FROM e.expected_phone
   OR c.mobile IS DISTINCT FROM e.expected_mobile
ORDER BY e.id;
