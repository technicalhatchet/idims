-- Contact data readiness report (read-only). Single result set for Supabase.
-- Date: 2026-10-17

WITH
s1 AS (
  SELECT
    '1_no_mobile'::text AS section,
    1 AS section_order,
    c.id,
    c.first_name,
    c.last_name,
    c.email,
    c.phone,
    c.mobile,
    NULL::text AS field,
    NULL::text AS raw_value,
    NULL::text AS detail
  FROM clients c
  WHERE c.mobile IS NULL OR btrim(c.mobile) = ''
),
s2 AS (
  SELECT
    '2_mobile_no_real_email',
    2,
    c.id,
    c.first_name,
    c.last_name,
    c.email,
    c.phone,
    c.mobile,
    NULL,
    NULL,
    NULL
  FROM clients c
  WHERE c.mobile IS NOT NULL AND btrim(c.mobile) <> ''
    AND (
      c.email IS NULL
      OR btrim(c.email) = ''
      OR lower(c.email) LIKE '%@noreply.%'
      OR lower(c.email) LIKE 'bookings+%@noreply.%'
    )
),
s3 AS (
  SELECT
    '3_email_only',
    3,
    c.id,
    c.first_name,
    c.last_name,
    c.email,
    c.phone,
    c.mobile,
    NULL,
    NULL,
    NULL
  FROM clients c
  WHERE c.email IS NOT NULL AND btrim(c.email) <> ''
    AND (c.mobile IS NULL OR btrim(c.mobile) = '')
    AND (c.phone IS NULL OR btrim(c.phone) = '')
),
s4 AS (
  SELECT
    '4_landline_only',
    4,
    c.id,
    c.first_name,
    c.last_name,
    c.email,
    c.phone,
    c.mobile,
    NULL,
    NULL,
    NULL
  FROM clients c
  WHERE c.phone IS NOT NULL AND btrim(c.phone) <> ''
    AND (c.mobile IS NULL OR btrim(c.mobile) = '')
),
s5 AS (
  SELECT
    '5_placeholder_email',
    5,
    c.id,
    c.first_name,
    c.last_name,
    c.email,
    c.phone,
    c.mobile,
    NULL,
    NULL,
    NULL
  FROM clients c
  WHERE c.email IS NOT NULL
    AND (
      lower(c.email) LIKE '%@noreply.%'
      OR lower(c.email) LIKE 'bookings+%@noreply.%'
    )
),
digits AS (
  SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.mobile, 'phone'::text AS field, c.phone AS raw
  FROM clients c
  WHERE c.phone IS NOT NULL AND btrim(c.phone) <> ''
  UNION ALL
  SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.mobile, 'mobile', c.mobile
  FROM clients c
  WHERE c.mobile IS NOT NULL AND btrim(c.mobile) <> ''
),
parsed AS (
  SELECT
    *,
    regexp_replace(raw, '\D', '', 'g') AS d
  FROM digits
),
s6 AS (
  SELECT
    '6_cannot_normalize',
    6,
    p.id,
    p.first_name,
    p.last_name,
    p.email,
    p.phone,
    p.mobile,
    p.field,
    p.raw AS raw_value,
    'digits=' || p.d || ', len=' || length(p.d)::text AS detail
  FROM parsed p
  WHERE NOT (
    length(p.d) = 10
    OR (length(p.d) = 11 AND left(p.d, 1) = '1')
  )
),
mobiles AS (
  SELECT
    c.id,
    regexp_replace(c.mobile, '\D', '', 'g') AS d
  FROM clients c
  WHERE c.mobile IS NOT NULL AND btrim(c.mobile) <> ''
),
mobile_norm AS (
  SELECT
    id,
    CASE
      WHEN length(d) = 10 THEN '+1' || d
      WHEN length(d) = 11 AND left(d, 1) = '1' THEN '+1' || right(d, 10)
      ELSE NULL
    END AS mobile_e164
  FROM mobiles
),
dup AS (
  SELECT
    mobile_e164,
    COUNT(*) AS client_count,
    array_agg(id ORDER BY id) AS client_ids
  FROM mobile_norm
  WHERE mobile_e164 IS NOT NULL
  GROUP BY mobile_e164
  HAVING COUNT(*) > 1
),
s7 AS (
  SELECT
    '7_duplicate_mobile',
    7,
    NULL::uuid,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    d.mobile_e164 AS raw_value,
    'count=' || d.client_count::text || ' ids=' || d.client_ids::text AS detail
  FROM dup d
)
SELECT section, section_order, id, first_name, last_name, email, phone, mobile, field, raw_value, detail
FROM s1
UNION ALL SELECT * FROM s2
UNION ALL SELECT * FROM s3
UNION ALL SELECT * FROM s4
UNION ALL SELECT * FROM s5
UNION ALL SELECT * FROM s6
UNION ALL SELECT * FROM s7
ORDER BY section_order, id NULLS LAST, field NULLS LAST;
