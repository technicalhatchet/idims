-- Optional reference SQL (prefer: python scripts/backfill_legacy_appointment_skus.py --execute)
-- Links work_order_service rows to visits via appointment_services_association.

-- Example: backfill M2M from existing appointment_id on service lines
INSERT INTO appointment_services_association (appointment_id, service_id)
SELECT wos.appointment_id, wos.service_id
FROM work_order_service wos
WHERE wos.appointment_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Verify bare visits
SELECT a.id, a.work_order_id, a.appointment_type, a.scheduled_start,
       count(asa.service_id) AS sku_count
FROM work_order_appointments a
LEFT JOIN appointment_services_association asa ON asa.appointment_id = a.id
GROUP BY a.id, a.work_order_id, a.appointment_type, a.scheduled_start
HAVING count(asa.service_id) = 0
ORDER BY a.scheduled_start DESC
LIMIT 50;
