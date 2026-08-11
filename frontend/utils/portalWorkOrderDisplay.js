import { resolveWorkOrderEquipmentDisplayName } from './workOrderEquipmentDisplay';

/** Client-facing appliance line: "Whirlpool Washing Machine" (no raw slugs). */
export function formatPortalWorkOrderAppliance(workOrder) {
  const make = workOrder?.equipment_make?.trim();
  const equipmentName = resolveWorkOrderEquipmentDisplayName(workOrder);
  if (make && equipmentName) {
    const makeLower = make.toLowerCase();
    const equipLower = equipmentName.toLowerCase();
    if (equipLower === makeLower) return equipmentName;
    if (equipLower.startsWith(`${makeLower} `)) return equipmentName;
    return `${make} ${equipmentName}`;
  }
  return make || equipmentName || 'Appliance';
}

export const PORTAL_REPAIR_STEPS = [
  'Scheduled',
  'In Progress',
  'Awaiting Payment',
  'Completed',
];

/** Progress index for the portal repair stepper (0-based). */
export function getPortalRepairProgressStep(status) {
  const s = String(status || '').toLowerCase();
  const map = {
    pending: 0,
    scheduled: 0,
    en_route: 1,
    in_progress: 1,
    waiting_on_parts: 1,
    parts_on_order: 1,
    on_hold: 1,
    completed_pending_payment: 2,
    completed: 3,
    closed: 3,
    canceled: 0,
  };
  return map[s] ?? 0;
}

export function getPortalInvoicePaymentSummary(invoice) {
  const paid = Number(invoice?.amount_paid || 0);
  const balance = Number(
    invoice?.balance_due ?? Math.max(0, Number(invoice?.total || 0) - paid),
  );

  if (invoice?.payment_status === 'paid' || balance <= 0.01) {
    return { type: 'paid', paid, balance: 0 };
  }
  if (invoice?.payment_status === 'partial' || (paid > 0 && balance > 0.01)) {
    return { type: 'partial', paid, balance };
  }
  return { type: 'outstanding', paid, balance };
}
