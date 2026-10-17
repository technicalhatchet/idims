const LABEL_TEXT = {
  verified_by_atomic: 'Verified by Atomic Repair',
  added_by_you: 'Added by you',
  from_service_history: 'From your service history',
};

/** Customer-facing provenance line for portal appliance lists. */
export function applianceCustomerSourceText(appliance) {
  if (!appliance) return null;
  if (appliance.customer_source_label_text) {
    return appliance.customer_source_label_text;
  }
  const key = appliance.customer_source_label || inferSourceLabelKey(appliance);
  return key ? LABEL_TEXT[key] : null;
}

function inferSourceLabelKey(appliance) {
  if (appliance.verified_by_staff_at) return 'verified_by_atomic';
  if (appliance.source === 'portal') return 'added_by_you';
  if (appliance.source === 'work_order_import' || appliance.source === 'work_order_sync') {
    return 'from_service_history';
  }
  if (appliance.source === 'staff' || appliance.source === 'manual') {
    return 'verified_by_atomic';
  }
  return null;
}

export function applianceNeedsStaffVerification(appliance) {
  if (!appliance || appliance.verified_by_staff_at) return false;
  return appliance.source === 'portal';
}
