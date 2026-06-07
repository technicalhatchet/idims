/** Work order statuses available in manual status-update UI (value → label). */
export const WORK_ORDER_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'en_route', label: 'En Route' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_on_parts', label: 'Waiting on Parts' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'completed_pending_payment', label: 'Completed — Pending Payment' },
  { value: 'pending_estimate_approval', label: 'Pending Estimate Approval' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'parts_on_order', label: 'Parts on Order' },
  { value: 'reschedule', label: 'Reschedule' },
  { value: 'need_to_contact', label: 'Need to Contact' },
  { value: 'unreachable', label: 'Unreachable' },
  { value: 'failed', label: 'Failed' },
  { value: 'recall', label: 'Recall / Warranty Return' },
  { value: 'redo', label: 'Redo' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'closed', label: 'Closed' },
];

/** Field techs cannot set these manually — completed flows via visit/payment; recall is office-only. */
export const TECH_MANUAL_WO_STATUS_BLOCKLIST = new Set([
  'completed',
  'completed_pending_payment',
  'recall',
  'closed',
  'refunded',
]);

export function workOrderStatusOptionsForUser({ role, isManager }) {
  const isFieldTech = role === 'technician' && !isManager;
  if (!isFieldTech) {
    return WORK_ORDER_STATUS_OPTIONS;
  }
  return WORK_ORDER_STATUS_OPTIONS.filter((o) => !TECH_MANUAL_WO_STATUS_BLOCKLIST.has(o.value));
}
