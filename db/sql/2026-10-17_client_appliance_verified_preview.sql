-- Read-only: staff/manual rows that will get verified_by_staff_at on forward migrate.
-- Run alone in Supabase before 2026-10-17_client_appliance_verified.sql. Date: 2026-10-17

WITH active AS (
  SELECT
    id,
    client_id,
    source,
    created_at,
    updated_at
  FROM client_appliances
  WHERE is_active = true
    AND merged_into_id IS NULL
),
summary AS (
  SELECT
    'summary_by_source'::text AS section,
    1 AS section_order,
    source AS label,
    COUNT(*)::text AS detail
  FROM active
  GROUP BY source
),
backfill AS (
  SELECT
    'will_backfill_staff_manual'::text AS section,
    2 AS section_order,
    NULL::text AS label,
    COUNT(*)::text AS detail
  FROM active
  WHERE source IN ('staff', 'manual')
),
portal_unverified AS (
  SELECT
    'portal_needs_staff_verify_later'::text AS section,
    3 AS section_order,
    NULL::text AS label,
    COUNT(*)::text AS detail
  FROM active
  WHERE source = 'portal'
)
SELECT section, section_order, label, detail
FROM summary
UNION ALL
SELECT * FROM backfill
UNION ALL
SELECT * FROM portal_unverified
ORDER BY section_order, label NULLS LAST;
