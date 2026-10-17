-- Read-only: values that cannot normalize to US E.164 (+1XXXXXXXXXX), plus summary row.
-- Single result set for Supabase SQL editor. Date: 2026-10-17

WITH digits AS (
  SELECT
    id,
    first_name,
    last_name,
    'phone' AS field,
    phone AS raw
  FROM clients
  WHERE phone IS NOT NULL AND btrim(phone) <> ''
  UNION ALL
  SELECT
    id,
    first_name,
    last_name,
    'mobile' AS field,
    mobile AS raw
  FROM clients
  WHERE mobile IS NOT NULL AND btrim(mobile) <> ''
),
parsed AS (
  SELECT
    id,
    first_name,
    last_name,
    field,
    raw,
    regexp_replace(raw, '\D', '', 'g') AS d
  FROM digits
),
norm AS (
  SELECT
    *,
    CASE
      WHEN length(d) = 10 THEN '+1' || d
      WHEN length(d) = 11 AND left(d, 1) = '1' THEN '+1' || right(d, 10)
      ELSE NULL
    END AS e164
  FROM parsed
),
detail_rows AS (
  SELECT
    'cannot_normalize'::text AS section,
    1 AS section_order,
    id,
    first_name,
    last_name,
    field,
    raw,
    d AS digits_only,
    length(d)::text AS note
  FROM norm
  WHERE e164 IS NULL
),
summary AS (
  SELECT
    'summary_count'::text AS section,
    2 AS section_order,
    NULL::uuid AS id,
    NULL::text AS first_name,
    NULL::text AS last_name,
    NULL::text AS field,
    NULL::text AS raw,
    NULL::text AS digits_only,
    COUNT(*)::text AS note
  FROM norm
  WHERE e164 IS NULL
)
SELECT section, section_order, id, first_name, last_name, field, raw, digits_only, note
FROM detail_rows
UNION ALL
SELECT section, section_order, id, first_name, last_name, field, raw, digits_only, note
FROM summary
ORDER BY section_order, field, id NULLS LAST;
