import { differenceInMonths, parseISO } from 'date-fns';
import { applianceDisplayName, subtypeLabel } from '../../../constants/applianceEquipment';

export const STATUS_FILTERS = [
  { value: 'all', label: 'All Status' },
  { value: 'active_request', label: 'Active Request' },
  { value: 'warranty', label: 'Under Warranty' },
  { value: 'maintenance_due', label: 'Maintenance Due' },
  { value: 'out_of_warranty', label: 'Out of Warranty' },
];

export const SORT_OPTIONS = [
  { value: 'property', label: 'Property' },
  { value: 'name', label: 'Name' },
  { value: 'last_service', label: 'Last Service' },
  { value: 'type', label: 'Type' },
];

export function propertyKey(appliance) {
  const prop = appliance?.property;
  if (prop?.id) return `prop:${prop.id}`;
  if (prop?.address) return `addr:${prop.address}`;
  if (appliance?.service_address) return `addr:${appliance.service_address}`;
  return 'unassigned';
}

export function propertyLabel(appliance) {
  const prop = appliance?.property;
  if (prop?.address) {
    return prop.unit_number ? `${prop.address} Unit ${prop.unit_number}` : prop.address;
  }
  if (appliance?.service_address) return appliance.service_address;
  return 'No property assigned';
}

export function applianceTypeLabel(appliance) {
  return subtypeLabel(
    appliance?.equipment_type || appliance?.type,
    appliance?.equipment_subtype || appliance?.subtype,
  ) || 'Appliance';
}

export function isMaintenanceDue(appliance) {
  if (appliance?.active_repair) return false;
  if (!appliance?.last_service_date) return false;
  try {
    const last = parseISO(appliance.last_service_date);
    return differenceInMonths(new Date(), last) >= 11;
  } catch {
    return false;
  }
}

export function getPrimaryStatus(appliance) {
  if (appliance?.active_repair) {
    return {
      key: 'active_request',
      label: 'Active Request',
      className: 'bg-orange-500/10 text-orange-400 border-orange-500/25',
    };
  }
  if (isMaintenanceDue(appliance)) {
    return {
      key: 'maintenance_due',
      label: 'Maintenance Due',
      className: 'bg-violet-500/10 text-violet-300 border-violet-500/25',
    };
  }
  if (appliance?.warranty_active) {
    return {
      key: 'warranty',
      label: 'Warranty',
      className: 'bg-green-500/10 text-green-400 border-green-500/25',
    };
  }
  return {
    key: 'out_of_warranty',
    label: 'Out of Warranty',
    className: 'bg-white/5 text-gray-400 border-white/10',
  };
}

export function matchesStatusFilter(appliance, statusFilter) {
  if (!statusFilter || statusFilter === 'all') return true;
  return getPrimaryStatus(appliance).key === statusFilter;
}

export function matchesSearch(appliance, query) {
  if (!query?.trim()) return true;
  const q = query.trim().toLowerCase();
  const haystack = [
    applianceDisplayName(appliance),
    appliance?.make,
    appliance?.model,
    appliance?.serial,
    appliance?.nickname,
    applianceTypeLabel(appliance),
    propertyLabel(appliance),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function computeSummary(appliances, propertyGroups) {
  const propertyCount = propertyGroups.length;
  const activeRequests = appliances.filter((a) => a.active_repair).length;
  const underWarranty = appliances.filter((a) => a.warranty_active).length;
  const maintenanceDue = appliances.filter((a) => isMaintenanceDue(a)).length;

  return {
    total: appliances.length,
    propertyCount,
    activeRequests,
    underWarranty,
    maintenanceDue,
  };
}

export function groupAppliancesByProperty(appliances) {
  const map = new Map();

  appliances.forEach((appliance) => {
    const key = propertyKey(appliance);
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: propertyLabel(appliance),
        appliances: [],
      });
    }
    map.get(key).appliances.push(appliance);
  });

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export function sortAppliances(appliances, sortBy) {
  const sorted = [...appliances];
  switch (sortBy) {
    case 'name':
      sorted.sort((a, b) => applianceDisplayName(a).localeCompare(applianceDisplayName(b)));
      break;
    case 'last_service':
      sorted.sort((a, b) => {
        const aDate = a.last_service_date ? new Date(a.last_service_date).getTime() : 0;
        const bDate = b.last_service_date ? new Date(b.last_service_date).getTime() : 0;
        return bDate - aDate;
      });
      break;
    case 'type':
      sorted.sort((a, b) => applianceTypeLabel(a).localeCompare(applianceTypeLabel(b)));
      break;
    case 'property':
    default:
      sorted.sort((a, b) => propertyLabel(a).localeCompare(propertyLabel(b)));
      break;
  }
  return sorted;
}

export function filterAppliances(appliances, { search, propertyFilter, statusFilter, typeFilter }) {
  return appliances.filter((appliance) => {
    if (!matchesSearch(appliance, search)) return false;
    if (propertyFilter && propertyFilter !== 'all' && propertyKey(appliance) !== propertyFilter) return false;
    if (!matchesStatusFilter(appliance, statusFilter)) return false;
    if (typeFilter && typeFilter !== 'all') {
      const subtype = appliance.equipment_subtype || appliance.subtype || '';
      if (subtype !== typeFilter) return false;
    }
    return true;
  });
}

export function propertyStats(appliances) {
  return {
    count: appliances.length,
    activeRequests: appliances.filter((a) => a.active_repair).length,
    underWarranty: appliances.filter((a) => a.warranty_active).length,
  };
}
