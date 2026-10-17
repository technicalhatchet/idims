import { resolveWorkOrderEquipmentDisplayName } from './workOrderEquipmentDisplay';
import { roundPortalMoney } from './portalMoney';

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
  'Waiting on Parts',
  'In Progress',
  'Awaiting Payment',
  'Completed',
];

export const PORTAL_WORK_ORDER_STATUS_LABELS = {
  pending: 'Pending',
  scheduled: 'Scheduled',
  en_route: 'En Route',
  in_progress: 'In Progress',
  waiting_on_parts: 'Waiting on Parts',
  parts_on_order: 'Parts on Order',
  on_hold: 'On Hold',
  completed_pending_payment: 'Pending Payment',
  completed: 'Completed',
  closed: 'Closed',
  canceled: 'Canceled',
};

export function getPortalWorkOrderStatusLabel(status) {
  const key = String(status || '').toLowerCase();
  return PORTAL_WORK_ORDER_STATUS_LABELS[key]
    || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const PARTS_HOLD_WO_STATUSES = new Set(['waiting_on_parts', 'parts_on_order']);

/** Parts-on-order summary for portal dashboard / repairs UX. */
export function getPortalWorkOrderPartsSummary(workOrder) {
  const parts = workOrder?.parts || [];
  const ordered = parts.filter((p) => p.status === 'ordered');
  const received = parts.filter((p) => p.status === 'received');
  const status = String(workOrder?.status || '').toLowerCase();
  const woOnHold = PARTS_HOLD_WO_STATUSES.has(status);
  const hasOrderedParts = ordered.length > 0 || status === 'parts_on_order';
  const hasReceivedParts = received.length > 0;

  return {
    ordered,
    received,
    woOnHold,
    hasOrderedParts,
    hasReceivedParts,
    hasPartsActivity: hasOrderedParts || hasReceivedParts || woOnHold,
  };
}

/** Active repairs with parts ordered, received, or waiting statuses. */
export function getActiveWorkOrdersWithPartsUpdates(workOrders = []) {
  return workOrders.filter((wo) => {
    const status = String(wo.status || '').toLowerCase();
    if (['completed', 'cancelled', 'closed', 'canceled'].includes(status)) return false;
    return getPortalWorkOrderPartsSummary(wo).hasPartsActivity;
  });
}

/** Pick the repair card most relevant for the dashboard (parts activity first). */
export function pickPortalDashboardActiveRepair(workOrders = []) {
  const active = workOrders.filter((wo) => {
    const status = String(wo.status || '').toLowerCase();
    return !['completed', 'cancelled', 'closed', 'canceled'].includes(status);
  });
  if (!active.length) return null;
  const withParts = active.find((wo) => getPortalWorkOrderPartsSummary(wo).hasPartsActivity);
  return withParts || active[0];
}

/** Progress index for the portal repair stepper (0-based). */
export function getPortalRepairProgressStep(status) {
  const s = String(status || '').toLowerCase();
  const map = {
    pending: 0,
    scheduled: 0,
    canceled: 0,
    waiting_on_parts: 1,
    parts_on_order: 1,
    en_route: 2,
    in_progress: 2,
    on_hold: 2,
    completed_pending_payment: 3,
    completed: 4,
    closed: 4,
  };
  return map[s] ?? 0;
}

export function buildPortalInvoiceLookup(invoices = []) {
  const map = new Map();
  invoices.forEach((inv) => {
    if (inv?.id) map.set(String(inv.id), inv);
    if (inv?.order_number) map.set(String(inv.order_number), inv);
  });
  return map;
}

/** Final work-order total (services + parts + tax − discount), aligned with invoices tab. */
export function getPortalWorkOrderDisplayTotal(workOrder, invoiceLookup) {
  if (!workOrder) return null;
  const woId = workOrder.id != null ? String(workOrder.id) : '';
  const orderNo = workOrder.order_number != null ? String(workOrder.order_number) : '';
  const inv = invoiceLookup?.get(woId) || invoiceLookup?.get(orderNo);
  if (inv?.total != null) {
    return roundPortalMoney(inv.total);
  }
  if (workOrder.invoice_total != null) {
    return roundPortalMoney(workOrder.invoice_total);
  }
  return null;
}

const CLOSED_WO_STATUSES = new Set(['completed', 'closed', 'canceled', 'cancelled']);

function isOpenWorkOrderInvoice(invoice) {
  const status = String(invoice?.work_order_status || '').toLowerCase();
  return status && !CLOSED_WO_STATUSES.has(status);
}

/** Portal booking deposit on a job that is not finished yet — not the same as paid in full. */
export function isOpenPortalPrepaidInvoice(invoice) {
  if (!isOpenWorkOrderInvoice(invoice)) return false;
  const paid = Number(invoice?.amount_paid || 0);
  if (paid <= 0.01) return false;
  return (
    invoice?.payment_status === 'prepaid'
    || invoice?.portal_diagnostic_prepaid === true
  );
}

export function getPortalInvoicePaymentSummary(invoice) {
  const paid = Number(invoice?.amount_paid || 0);
  const total = Number(invoice?.total || 0);
  const balance = Number(
    invoice?.balance_due ?? Math.max(0, total - paid),
  );

  const zeroTotalOpenJob = total <= 0.01 && isOpenWorkOrderInvoice(invoice);
  if (zeroTotalOpenJob) {
    return { type: 'pending', paid, balance: 0, total };
  }

  if (isOpenPortalPrepaidInvoice(invoice)) {
    return { type: 'prepaid', paid, balance, total };
  }

  if (invoice?.payment_status === 'paid' || balance <= 0.01) {
    return { type: 'paid', paid, balance: 0, total };
  }
  if (invoice?.payment_status === 'partial' || (paid > 0 && balance > 0.01)) {
    return { type: 'partial', paid, balance, total };
  }
  return { type: 'outstanding', paid, balance, total: total || balance };
}

/** Display status for portal invoice cards (no overdue — due on receipt). */
export function getPortalInvoiceDisplayStatus(invoice) {
  const summary = getPortalInvoicePaymentSummary(invoice);
  if (summary.type === 'pending') return 'pending';
  if (summary.type === 'prepaid') return 'prepaid';
  if (summary.type === 'paid') return 'paid';
  if (summary.type === 'partial') return 'partial';
  return 'outstanding';
}

/** Sum of amount_paid across invoices (for stat tiles). */
export function sumPortalInvoicesAmountPaid(invoices = []) {
  return invoices.reduce((sum, inv) => sum + Number(inv?.amount_paid || 0), 0);
}

/** Invoices eligible for portal bulk pay. */
export function getPortalPayableInvoices(invoices = []) {
  return invoices.filter(
    (inv) => inv.can_pay_online && Number(inv.balance_due) >= 1,
  );
}

/** Human-readable line for bulk payment notes / UI. */
export function formatPortalInvoiceBulkLine(invoice) {
  const order = invoice?.order_number || 'Invoice';
  const appliance = formatPortalWorkOrderAppliance(invoice);
  return `${order} (${appliance})`;
}
