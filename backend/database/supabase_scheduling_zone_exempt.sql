-- Per-client exemption from portal service-area / zone checks (repeat clients outside zip zones).
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS scheduling_zone_exempt BOOLEAN NOT NULL DEFAULT FALSE;

-- Scott Stevenson — pre-approved repeat client (no mapped zone).
UPDATE clients
SET scheduling_zone_exempt = TRUE,
    updated_at = NOW()
WHERE LOWER(TRIM(first_name)) = 'scott'
  AND LOWER(TRIM(last_name)) = 'stevenson';

-- Verify:
-- SELECT id, first_name, last_name, scheduling_zone_exempt FROM clients
-- WHERE LOWER(last_name) = 'stevenson';
