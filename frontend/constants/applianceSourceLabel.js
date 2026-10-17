export const VERIFIED_SOURCE_LABEL = '✓ Verified';
export const ADDED_BY_YOU_LABEL = 'Added by you';

const VERIFIED_SOURCES = new Set([
  'staff',
  'manual',
  'work_order_import',
  'work_order_sync',
]);

/** True when UI should show the verified inline label. */
export function applianceIsVerified(appliance) {
  if (!appliance) return false;
  if (appliance.verified_by_staff_at) return true;
  return VERIFIED_SOURCES.has(appliance.source);
}

/** Short inline label text, or null when no provenance line applies. */
export function applianceSourceInlineText(appliance) {
  if (!appliance) return null;
  if (applianceIsVerified(appliance)) return VERIFIED_SOURCE_LABEL;
  if (appliance.source === 'portal') return ADDED_BY_YOU_LABEL;
  return null;
}

export function applianceSourceInlineTone(appliance) {
  return applianceIsVerified(appliance) ? 'verified' : 'customer';
}

/** @deprecated Use applianceSourceInlineText — kept for API fallbacks during rollout */
export function applianceCustomerSourceText(appliance) {
  if (!appliance) return null;
  const fromApi = appliance.customer_source_label;
  if (fromApi === 'from_service_history') {
    return VERIFIED_SOURCE_LABEL;
  }
  if (appliance.customer_source_label_text) {
    if (appliance.customer_source_label_text === 'Verified by Atomic Repair') {
      return VERIFIED_SOURCE_LABEL;
    }
    if (appliance.customer_source_label_text === 'From your service history') {
      return VERIFIED_SOURCE_LABEL;
    }
    return appliance.customer_source_label_text;
  }
  return applianceSourceInlineText(appliance);
}

export function applianceNeedsStaffVerification(appliance) {
  if (!appliance || appliance.verified_by_staff_at) return false;
  return appliance.source === 'portal';
}
