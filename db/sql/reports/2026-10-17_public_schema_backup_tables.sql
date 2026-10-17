-- Read-only: tables in public schema whose name contains "backup".
-- Use to find older backup tables before new migrations. Date: 2026-10-17

SELECT
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name ILIKE '%backup%'
ORDER BY table_name;
