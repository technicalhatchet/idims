import { format, parseISO } from 'date-fns';
import { getPortalWorkOrderDisplayTotal } from './portalWorkOrderDisplay';

/** Customer can approve or decline on the portal right now. */
export function portalEstimateNeedsCustomerAction(workOrder) {
  if (!workOrder) return false;
  if (workOrder.status !== 'pending_estimate_approval') return false;
  if (!workOrder.estimate_available) return false;
  const ea = workOrder.estimate_approval || {};
  return Boolean(ea.can_approve || ea.can_decline);
}

export function portalEstimateApprovalTotal(workOrder, invoiceLookup) {
  const fromSummary = workOrder?.estimate_approval?.total;
  if (fromSummary != null && !Number.isNaN(Number(fromSummary))) {
    return Number(fromSummary);
  }
  return getPortalWorkOrderDisplayTotal(workOrder, invoiceLookup);
}

/** Short label for collapsed repair card after a decision. */
export function portalEstimateDecisionCardLabel(workOrder) {
  if (!workOrder || workOrder.status !== 'pending_estimate_approval') return null;
  const ea = workOrder.estimate_approval || {};
  if (portalEstimateNeedsCustomerAction(workOrder)) return null;
  if (!ea.current_decision) return null;
  if (ea.current_decision === 'approved') {
    const when = ea.decided_at
      ? format(parseISO(ea.decided_at), 'MMM d, yyyy')
      : null;
    return when ? `Approved ${when}` : 'Approved';
  }
  return 'Declined';
}

export const PORTAL_ESTIMATE_APPROVAL_AMBER = {
  border: '1px solid rgba(245,158,11,0.5)',
  boxShadow: '0 0 24px rgba(245,158,11,0.14)',
  badgeBg: 'rgba(245,158,11,0.15)',
  badgeColor: '#fbbf24',
  badgeBorder: 'rgba(245,158,11,0.35)',
  buttonBg: 'rgba(245,158,11,0.2)',
  buttonColor: '#fcd34d',
  buttonBorder: 'rgba(245,158,11,0.45)',
};
