-- Read-only: phone/mobile values that will change when you run 2026-10-17_normalize_phones.sql.
-- Run this file alone in Supabase (single SELECT). Date: 2026-10-17

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
    phone AS value_before,
    CASE
      WHEN phone IS NULL OR btrim(phone) = '' THEN NULL
      WHEN length(phone_d) = 10 THEN '+1' || phone_d
      WHEN length(phone_d) = 11 AND left(phone_d, 1) = '1' THEN '+1' || right(phone_d, 10)
      ELSE phone
    END AS value_after
  FROM base
  WHERE phone IS NOT NULL AND btrim(phone) <> ''
),
phone_changes AS (
  SELECT
    id,
    'phone'::text AS field,
    value_before,
    value_after
  FROM calc
  WHERE value_before IS DISTINCT FROM value_after
),
mobile_calc AS (
  SELECT
    id,
    mobile AS value_before,
    CASE
      WHEN mobile IS NULL OR btrim(mobile) = '' THEN NULL
      WHEN length(mobile_d) = 10 THEN '+1' || mobile_d
      WHEN length(mobile_d) = 11 AND left(mobile_d, 1) = '1' THEN '+1' || right(mobile_d, 10)
      ELSE mobile
    END AS value_after
  FROM base
  WHERE mobile IS NOT NULL AND btrim(mobile) <> ''
),
mobile_changes AS (
  SELECT
    id,
    'mobile'::text AS field,
    value_before,
    value_after
  FROM mobile_calc
  WHERE value_before IS DISTINCT FROM value_after
)
SELECT
  u.id,
  u.field,
  u.value_before,
  u.value_after,
  c.first_name,
  c.last_name,
  c.email
FROM (
  SELECT * FROM phone_changes
  UNION ALL
  SELECT * FROM mobile_changes
) u
JOIN clients c ON c.id = u.id
ORDER BY u.id, u.field;
