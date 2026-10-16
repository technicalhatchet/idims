import {
  formatPortalWorkOrderAppliance,
  getActiveWorkOrdersWithPartsUpdates,
  getPortalWorkOrderPartsSummary,
} from './portalWorkOrderDisplay';

/** Dashboard-style alerts surfaced in the header bell. */
export function buildPortalNotificationsFromWorkOrders(workOrders = []) {
  const withParts = getActiveWorkOrdersWithPartsUpdates(workOrders);
  const items = [];

  withParts.forEach((workOrder) => {
    const summary = getPortalWorkOrderPartsSummary(workOrder);
    const appliance = formatPortalWorkOrderAppliance(workOrder);
    const receivedPart = summary.received[0];
    const orderedPart = summary.ordered[0];
    const isReceived = summary.hasReceivedParts;
    const partName = (isReceived ? receivedPart?.name : orderedPart?.name) || 'a part';

    items.push({
      id: `parts-${workOrder.id}`,
      title: isReceived ? 'Part arrived for your repair' : 'Part ordered for your repair',
      message: isReceived
        ? `${partName} for your ${appliance} has arrived. We'll contact you to schedule your return visit.`
        : `We've ordered ${partName} for your ${appliance} (order #${workOrder.order_number}).`,
      unread: true,
      relatedType: 'work_order',
      relatedId: workOrder.id,
      created_at: workOrder.updated_at || workOrder.created_at,
    });
  });

  return items;
}
