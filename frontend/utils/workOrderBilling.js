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
  if ((billingTotals.dueLater || 0) > 0.01) return false;
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

/**
 * Use the tax_rate from the work order API only (backend resolves falsy → default-county).
 * Do not invent a client-side fallback — FE and Square balance_due must stay identical.
 */
export function resolveWorkOrderTaxRate(workOrder) {
  const raw = parseFloat(workOrder?.tax_rate);
  if (!Number.isFinite(raw) || raw <= 0) {
    console.warn(
      '[billing] workOrder.tax_rate missing/falsy; expecting API to send TaxService default-county rate',
      workOrder?.id || workOrder?.order_number,
    );
    return 0;
  }
  return raw;
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

/** Diagnostic SKU line (not trip charge, not repair). Mirrors backend is_diagnostic_service_line. */
export function isDiagnosticServiceLine(service) {
  if (!service || isTripChargeServiceLine(service)) return false;
  const type = String(service.service_definition?.service_type || service.service_type || '').toLowerCase();
  if (type === 'diagnostic') return true;
  if (type === 'repair') return false;
  const name = (service.name || '').toLowerCase();
  return name.includes('diagnostic') && !name.includes('repair');
}

/**
 * Full diagnostic amount the credit is figured from. Stamped work_orders.diagnostic_discount_amount
 * when set; otherwise the diagnostic line price(s), any status but waived — so the credit shows on
 * estimates while every SKU is still not billable. Mirrors backend diagnostic_credit_base().
 * chargeableOnly (money math) counts only billable/paid diagnostic lines.
 */
export function diagnosticCreditBase(workOrder, allServices, { chargeableOnly = false } = {}) {
  const stamped = parseFloat(workOrder?.diagnostic_discount_amount);
  if (Number.isFinite(stamped) && stamped > 0) return round2(stamped);
  const total = (allServices || [])
    .filter((s) => {
      const status = String(s.billing_status || '').toLowerCase();
      if (status === 'waived') return false;
      return !chargeableOnly || CHARGEABLE_SERVICE_BILLING_STATUSES.has(status);
    })
    .filter(isDiagnosticServiceLine)
    .reduce((sum, s) => sum + serviceLineTotal(s), 0);
  return total > 0 ? round2(total) : 0;
}

/** Discount row shows whenever a repair SKU is on the order and there's a diagnostic to credit. */
export function showDiagnosticCreditRow(workOrder, allServices) {
  return workOrderHasRepairSku(allServices) && diagnosticCreditBase(workOrder, allServices) > 0;
}

/** Credit dollars after 50%/100% mode. chargeableOnly for amounts actually subtracted from what's owed. */
export function appliedDiagnosticCreditAmount(workOrder, allServices, { chargeableOnly = false } = {}) {
  if (!workOrderHasRepairSku(allServices)) return 0;
  const base = diagnosticCreditBase(workOrder, allServices, { chargeableOnly });
  if (!(base > 0)) return 0;
  return diagnosticCreditDollars(base, resolveDiagnosticCreditMode(workOrder));
}

export function sumRecordedPayments(payments) {
  return round2(
    (payments || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
  );
}

/** Collapsed accordion header, e.g. "3 payments · $172.50" */
export function recordedPaymentsSummary(payments) {
  const items = payments || [];
  const n = items.length;
  if (n === 0) return 'No payments';
  return `${n} payment${n === 1 ? '' : 's'} · $${sumRecordedPayments(items).toFixed(2)}`;
}

export function diagnosticCreditOverrideSummary(workOrder) {
  return isHalfDiagnosticCreditMode(workOrder)
    ? '50% diagnostic credit'
    : '100% diagnostic credit';
}

/** Latest payment_date from recorded payments (for paid-in-full display). */
export function latestRecordedPaymentDate(payments) {
  let latest = null;
  for (const p of payments || []) {
    if (!p?.payment_date) continue;
    const d = new Date(p.payment_date);
    if (Number.isNaN(d.getTime())) continue;
    if (!latest || d > latest) latest = d;
  }
  return latest;
}

/**
 * Paid-in-full billing row: nothing due today, nothing still owed on the estimate (repair
 * not done yet), and at least one recorded payment. Diag paid + repair pending = Due later, not paid.
 */
export function showPaidInFullBillingRow(dueToday, payments, dueLater = 0) {
  return round2(dueToday) <= 0 && round2(dueLater || 0) <= 0 && (payments?.length ?? 0) > 0;
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
      dueLater: 0,
      projectedTotal: 0,
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
  const discountAmt = hasRepairSku
    ? appliedDiagnosticCreditAmount(workOrder, allServices, { chargeableOnly: true })
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

  // Due later: what the estimate will still cost once the repair is done (estimate lines,
  // quoted parts + tax, minus the diagnostic credit that comes off the repair).
  const projectedServices = (allServices || [])
    .filter((s) => String(s.billing_status || '').toLowerCase() !== 'waived')
    .reduce((sum, s) => sum + serviceLineTotal(s), 0);
  const projectedParts = (workOrder.parts || [])
    .filter((p) => !PART_NON_TAXABLE_STATUSES.includes(p.status))
    .reduce((sum, p) => sum + parseFloat(p.price || 0), 0);
  const projectedCredit = hasRepairSku ? appliedDiagnosticCreditAmount(workOrder, allServices) : 0;
  const projectedTotal = round2(projectedServices + projectedParts + taxOnParts - projectedCredit);
  const dueLater = Math.max(0, round2(projectedTotal - previouslyPaid - dueToday));

  return { dueToday, dueLater, projectedTotal, taxOnBillableParts, totalWorkOrder, previouslyPaid };
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
