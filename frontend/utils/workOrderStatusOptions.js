/**
 * Work order statuses available in manual status-update UI (value → label).
 * Must match backend work_order_status_enum. "Failed" is a visit status (shown as APR), not a job status.
 * Not offered here (still valid in the enum, so older jobs keep displaying):
 *  - completed / closed: set by the payment and Close Order flows, never picked by hand.
 *  - recall: same meaning as Redo, which is the one to use.
 */
export const WORK_ORDER_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'en_route', label: 'En Route' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_on_parts', label: 'Waiting on Parts' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed_pending_payment', label: 'Completed — Pending Payment' },
  { value: 'pending_estimate_approval', label: 'Pending Estimate Approval' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'parts_received', label: 'Parts Received' },
  { value: 'reschedule', label: 'Reschedule' },
  { value: 'need_to_contact', label: 'Need to Contact' },
  { value: 'unreachable', label: 'Unreachable' },
  { value: 'redo', label: 'Redo' },
  { value: 'refunded', label: 'Refunded' },
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

/**
 * Sections for the mobile status sheet. Anything not listed falls into the last section
 * so a new enum value still shows up somewhere.
 */
export const WORK_ORDER_STATUS_GROUPS = [
  { key: 'job', label: 'ON THE JOB', tone: 'cyan', values: ['pending', 'scheduled', 'en_route', 'in_progress'] },
  { key: 'parts', label: 'PARTS', tone: 'orange', values: ['waiting_on_parts', 'parts_received'] },
  {
    key: 'follow_up',
    label: 'FOLLOW-UP',
    tone: 'cyan',
    values: ['need_to_contact', 'unreachable', 'reschedule', 'on_hold', 'pending_estimate_approval', 'redo'],
  },
  { key: 'close_out', label: 'CLOSE OUT', tone: 'cyan', values: ['completed_pending_payment', 'refunded', 'canceled'] },
];

/** Group a (possibly role-filtered) options list into the sheet's sections, dropping empty ones. */
export function groupWorkOrderStatusOptions(options) {
  const placed = new Set();
  const groups = WORK_ORDER_STATUS_GROUPS.map((g) => {
    const items = g.values
      .map((v) => options.find((o) => o.value === v))
      .filter(Boolean);
    items.forEach((o) => placed.add(o.value));
    return { key: g.key, label: g.label, tone: g.tone, items };
  });
  const leftovers = options.filter((o) => !placed.has(o.value));
  if (leftovers.length) groups[groups.length - 1].items.push(...leftovers);
  return groups.filter((g) => g.items.length);
}

const LABELS_NOT_OFFERED = { completed: 'Completed', closed: 'Closed', recall: 'Redo' };

/** Display label for any work order status value, including ones not offered for manual change. */
export function workOrderStatusLabel(value) {
  if (!value) return '';
  const hit = WORK_ORDER_STATUS_OPTIONS.find((o) => o.value === value);
  if (hit) return hit.label;
  if (LABELS_NOT_OFFERED[value]) return LABELS_NOT_OFFERED[value];
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
