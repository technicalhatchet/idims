import Link from 'next/link';
import { FaBoxOpen, FaTruck } from 'react-icons/fa';
import {
  formatPortalWorkOrderAppliance,
  getActiveWorkOrdersWithPartsUpdates,
  getPortalWorkOrderPartsSummary,
} from '../../utils/portalWorkOrderDisplay';

/**
 * Dashboard banner when a repair has parts ordered or received.
 */
export default function PartsUpdateCallout({ workOrders = [] }) {
  const withParts = getActiveWorkOrdersWithPartsUpdates(workOrders);
  if (!withParts.length) return null;

  const receivedWo = withParts.find((wo) => getPortalWorkOrderPartsSummary(wo).hasReceivedParts);
  const workOrder = receivedWo || withParts[0];
  const summary = getPortalWorkOrderPartsSummary(workOrder);
  const appliance = formatPortalWorkOrderAppliance(workOrder);
  const href = `/cxdashboard/repairs?work_order=${workOrder.id}`;

  const receivedPart = summary.received[0];
  const orderedPart = summary.ordered[0];
  const isReceived = summary.hasReceivedParts;

  const title = isReceived ? 'Part arrived for your repair' : 'Part ordered for your repair';
  const partName = (isReceived ? receivedPart?.name : orderedPart?.name) || 'A part';
  const message = isReceived
    ? `${partName} for your ${appliance} has arrived. We'll contact you to schedule your return visit.`
    : `We've ordered ${partName} for your ${appliance} (order #${workOrder.order_number}). We'll notify you when it arrives.`;

  return (
    <Link
      href={href}
      className="block rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 md:p-5 transition-colors hover:bg-amber-500/15"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
          {isReceived ? (
            <FaBoxOpen className="w-5 h-5 text-amber-300" />
          ) : (
            <FaTruck className="w-5 h-5 text-amber-300" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-amber-200 font-semibold text-sm md:text-base">{title}</p>
          <p className="text-amber-100/80 text-xs md:text-sm mt-1 leading-relaxed">{message}</p>
          <p className="text-amber-400/70 text-xs mt-2 font-medium">View repair details →</p>
        </div>
      </div>
    </Link>
  );
}
