import { hasCompletedRepairAppointment } from './appointmentStatusLabels';

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const PART_DUE_STATUSES = ['phone_payment', 'upfront_50', 'installed', 'paid_not_installed'];

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

  const taxRate = parseFloat(workOrder.tax_rate || 0.0775);
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
  const PART_BILLABLE = ['phone_payment', 'paid_not_installed', 'upfront_50', 'installed'];
  const partsSubtotal = (workOrder.parts || [])
    .filter((p) => PART_BILLABLE.includes(p.status))
    .reduce((sum, p) => sum + parseFloat(p.price || 0), 0);
  const taxOnParts = round2(partsSubtotal * taxRate);
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
