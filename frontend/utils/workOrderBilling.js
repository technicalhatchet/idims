import { hasCompletedRepairAppointment } from './appointmentStatusLabels';

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const CLOSED_WO_STATUSES = new Set(['completed', 'closed', 'canceled', 'cancelled']);

export function isOpenWorkOrderStatus(status) {
  return !CLOSED_WO_STATUSES.has(String(status || '').toLowerCase());
}

export function hasPortalDiagnosticPrepayment(workOrder) {
  return Boolean(
    workOrder?.portal_diagnostic_prepaid
    || workOrder?.portal_scheduling_meta?.payment?.square_payment_id,
  );
}

/** Open job with portal booking deposit — not paid in full for the visit. */
export function isOpenJobPortalPrepaidDeposit(workOrder) {
  if (!workOrder || !isOpenWorkOrderStatus(workOrder.status)) return false;
  if (!hasPortalDiagnosticPrepayment(workOrder)) return false;
  return parseFloat(workOrder.amount_previously_paid || 0) > 0;
}

/** Invoice PDF / header: only true paid-in-full when the job is actually closed out. */
export function isWorkOrderPaidInFullForDocuments(workOrder, billingTotals) {
  if (!billingTotals) return false;
  if (billingTotals.dueToday > 0.01 || billingTotals.previouslyPaid <= 0) return false;
  if (isOpenJobPortalPrepaidDeposit(workOrder)) return false;
  return true;
}

export const PART_DUE_STATUSES = ['phone_payment', 'upfront_50', 'installed', 'paid_not_installed'];
export const PART_NON_TAXABLE_STATUSES = ['not_installed'];

/** Service lines that count toward balance due (paid diag + billable repair; not waived / estimate). */
export const CHARGEABLE_SERVICE_BILLING_STATUSES = new Set(['billable', 'paid']);

export const SERVICE_BILLING_STATUS_OPTIONS = [
  { value: 'not_billable', label: 'Not Billable' },
  { value: 'billable', label: 'Billable' },
  { value: 'paid', label: 'Paid' },
  { value: 'waived', label: 'Waived' },
];

export function isTripChargeServiceLine(service) {
  if (!service) return false;
  const sku = (service.sku_code || service.service_definition?.sku_code || '').toUpperCase();
  const name = (service.name || '').toLowerCase();
  if (sku.includes('TRIP')) return true;
  return name.includes('trip charge');
}

/** Hide $0 trip charge lines on billing UI — local zone still adds the SKU at zero. */
export function isHiddenZeroTripChargeLine(service) {
  if (!isTripChargeServiceLine(service)) return false;
  const price = parseFloat(service.price ?? service.unit_price ?? 0);
  return !Number.isFinite(price) || price <= 0;
}

export function billingDisplayServices(services) {
  return (services || []).filter((service) => !isHiddenZeroTripChargeLine(service));
}

/** Line total for billing math — matches backend `_service_line_total`. */
export function serviceLineTotal(service) {
  if (!service) return 0;
  const price = parseFloat(service.price);
  if (Number.isFinite(price) && price > 0) return round2(price);
  const totalPrice = parseFloat(service.total_price);
  if (Number.isFinite(totalPrice) && totalPrice > 0) return round2(totalPrice);
  const unit = parseFloat(service.unit_price || 0);
  const qty = parseFloat(service.quantity || service.qty || 1);
  return round2(unit * qty);
}

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

export function resolveDiagnosticCreditMode(workOrder) {
  const mode = String(workOrder?.diagnostic_credit_mode || 'half').toLowerCase();
  return mode === 'full' ? 'full' : 'half';
}

export function isHalfDiagnosticCreditMode(workOrder) {
  return resolveDiagnosticCreditMode(workOrder) === 'half';
}

/** Half credit rounds up to whole dollars ($89 -> $45). Full uses stored diagnostic amount. */
export function diagnosticCreditDollars(diagnosticDiscountAmount, mode = 'half') {
  const raw = parseFloat(diagnosticDiscountAmount);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (mode === 'full') return round2(raw);
  return Math.ceil(raw / 2);
}

export function workOrderHasRepairSku(allServices) {
  return (allServices || []).some(
    (s) =>
      s.name?.toLowerCase().includes('repair') ||
      s.service_definition?.service_type === 'repair',
  );
}

export function appliedDiagnosticCreditAmount(workOrder, allServices) {
  if (!workOrderHasRepairSku(allServices)) return 0;
  if (!(parseFloat(workOrder?.diagnostic_discount_amount) > 0)) return 0;
  return diagnosticCreditDollars(
    workOrder.diagnostic_discount_amount,
    resolveDiagnosticCreditMode(workOrder),
  );
}

export async function persistDiagnosticCreditMode(workOrderId, mode) {
  const { apiClient } = await import('./api-client');
  return apiClient(`work-orders/${workOrderId}/diagnostic-credit-mode`, {
    method: 'PUT',
    body: JSON.stringify({ diagnostic_credit_mode: mode }),
  });
}

/**
 * Due today: chargeable services (billable + paid) + due parts + part tax − payments − discount.
 * Diagnostic credit uses work_orders.diagnostic_credit_mode (persisted).
 */
export function computeWorkOrderDueToday(workOrder, allServices) {
  if (!workOrder) {
    return {
      dueToday: 0,
      taxOnBillableParts: 0,
      totalWorkOrder: 0,
      previouslyPaid: 0,
    };
  }

  const taxRate = resolveWorkOrderTaxRate(workOrder);
  const hasRepairSku = workOrderHasRepairSku(allServices);
  const repairCompleted = hasCompletedRepairAppointment(workOrder.appointments, {
    catalogServices: allServices,
    workOrderServices: allServices,
  });
  const discountAmt =
    hasRepairSku && workOrder?.diagnostic_discount_amount > 0
      ? appliedDiagnosticCreditAmount(workOrder, allServices)
      : 0;

  const chargeableServices = (allServices || [])
    .filter((s) => CHARGEABLE_SERVICE_BILLING_STATUSES.has(s.billing_status))
    .reduce((sum, s) => sum + serviceLineTotal(s), 0);
  const billableParts = (workOrder.parts || [])
    .filter((p) => PART_DUE_STATUSES.includes(p.status))
    .reduce((sum, p) => sum + parseFloat(p.price || 0), 0);
  const taxOnBillableParts = round2(billableParts * taxRate);
  const previouslyPaid = round2(parseFloat(workOrder.amount_previously_paid || 0));
  const dueTodayDiscount = repairCompleted ? discountAmt : 0;
  const dueToday = Math.max(
    0,
    round2(chargeableServices + billableParts + taxOnBillableParts - previouslyPaid - dueTodayDiscount)
  );

  const servicesSubtotal = (allServices || []).reduce((sum, s) => sum + serviceLineTotal(s), 0);
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
