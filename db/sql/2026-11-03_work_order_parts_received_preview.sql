-- Read-only: jobs currently on parts-related statuses, with their part statuses,
-- so you can decide which "Parts on Order" jobs should become "Parts Received".
-- Date: 2026-11-03

SELECT
  wo.id,
  wo.order_number,
  wo.status AS work_order_status,
  COUNT(p.id) AS parts_total,
  COUNT(p.id) FILTER (WHERE p.status = 'ordered') AS parts_ordered,
  COUNT(p.id) FILTER (WHERE p.status IN ('received', 'on_hand')) AS parts_in_hand,
  wo.updated_at
FROM work_orders wo
LEFT JOIN work_order_parts p ON p.work_order_id = wo.id
WHERE wo.status IN ('parts_on_order', 'waiting_on_parts')
GROUP BY wo.id, wo.order_number, wo.status, wo.updated_at
ORDER BY wo.status, wo.updated_at DESC;
