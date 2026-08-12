import { hasCompletedRepairAppointment } from './appointmentStatusLabels';

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export const PART_DUE_STATUSES = ['phone_payment', 'upfront_50', 'installed', 'paid_not_installed'];
export const PART_NON_TAXABLE_STATUSES = ['not_installed'];

export const SERVICE_BILLING_STATUS_OPTIONS = [
  { value: 'not_billable', label: 'Not Billable' },
  { value: 'billable', label: 'Billable' },
  { value: 'paid', label: 'Paid' },
  { value: 'waived', label: 'Waived' },
];

/** Unscheduled estimate line — no visit, not yet billable. */
export function isUnscheduledEstimateLine(item) {
  return !item?.appointment_id && item?.billing_status === 'not_billable';
}

export function resolveWorkOrderTaxRate(workOrder) {
  const raw = parseFloat(workOrder?.tax_rate);
  return Number.isFinite(raw) && raw > 0 ? raw : 0.0775;
}

export function formatTaxPercent(taxRate) {
  return (taxRate * 100).toFixed(2);
}

/** Parts that count toward sales tax on invoice / billing totals (quoted parts, not scrapped). */
export function taxablePartsSubtotal(workOrder) {
  return (workOrder?.parts || [])
    .filter((p) => !PART_NON_TAXABLE_STATUSES.includes(p.status))
    .reduce((sum, p) => sum + parseFloat(p.price || 0), 0);
}

/**
 * Mirrors invoice-tab due-today math (services + billable parts + part tax − paid − discount).
 */
export function computeWorkOrderDueToday(workOrder, allServices, halfDiagnosticDiscount = false) {
  if (!workOrder) {
    return {
      dueToday: 0,
      taxOnBillableParts: 0,
      totalWorkOrder: 0,
      previouslyPaid: 0,
    };
  }

  const taxRate = resolveWorkOrderTaxRate(workOrder);
  const hasRepairSku = (allServices || []).some(
    (s) =>
      s.name?.toLowerCase().includes('repair') ||
      s.service_definition?.service_type === 'repair'
  );
  const repairCompleted = hasCompletedRepairAppointment(workOrder.appointments, {
    catalogServices: allServices,
    workOrderServices: allServices,
  });
  const discountAmt =
    hasRepairSku && workOrder?.diagnostic_discount_amount > 0
      ? halfDiagnosticDiscount
        ? round2(workOrder.diagnostic_discount_amount * 0.5)
        : round2(workOrder.diagnostic_discount_amount)
      : 0;

  const billableServices = (allServices || [])
    .filter((s) => s.billing_status === 'billable')
    .reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
  const billableParts = (workOrder.parts || [])
    .filter((p) => PART_DUE_STATUSES.includes(p.status))
    .reduce((sum, p) => sum + parseFloat(p.price || 0), 0);
  const taxOnBillableParts = round2(billableParts * taxRate);
  const previouslyPaid = round2(parseFloat(workOrder.amount_previously_paid || 0));
  const dueTodayDiscount = repairCompleted ? discountAmt : 0;
  const dueToday = Math.max(
    0,
    round2(billableServices + billableParts + taxOnBillableParts - previouslyPaid - dueTodayDiscount)
  );

  const servicesSubtotal = (allServices || []).reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
  const partsSubtotal = (workOrder.parts || []).reduce(
    (sum, p) => sum + parseFloat(p.price || 0),
    0,
  );
  const taxableParts = taxablePartsSubtotal(workOrder);
  const taxOnParts = round2(taxableParts * taxRate);
  const totalWorkOrder = round2(
    servicesSubtotal + partsSubtotal + taxOnParts - (repairCompleted ? discountAmt : 0)
  );

  return { dueToday, taxOnBillableParts, totalWorkOrder, previouslyPaid };
}

/** Part line is paid when status says so, collected in full, or WO balance is settled. */
export function isPartLinePaid(part, dueToday) {
  if (!part) return false;
  if (part.status === 'phone_payment' || part.status === 'paid_not_installed') return true;

  const price = parseFloat(part.price || 0);
  const collected = parseFloat(part.amount_upfront_collected || 0);
  if (
    price > 0 &&
    collected >= price - 0.005 &&
    (part.status === 'installed' || part.status === 'upfront_50')
  ) {
    return true;
  }

  if (dueToday <= 0 && (part.status === 'installed' || part.status === 'upfront_50')) {
    return true;
  }
  return false;
}
