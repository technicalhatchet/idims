/**
 * Public booking flow — appliance ids, fuel sub-types, and equipment field mapping.
 */

export const BOOKING_FUEL_OPTIONS = {
  dryer: [
    { value: 'electric', label: 'Electric', subtype: 'electric_dryer' },
    { value: 'gas', label: 'Gas', subtype: 'gas_dryer' },
  ],
  oven: [
    { value: 'electric', label: 'Electric', subtype: 'electric_range' },
    { value: 'gas', label: 'Gas', subtype: 'gas_range' },
  ],
};

/** Booking tile id → work order equipment_subtype when no fuel step applies. */
const BOOKING_APPLIANCE_SUBTYPE = {
  refrigerator: 'refrigerator',
  washer: 'washing_machine',
  dryer: 'dryer',
  aiolaundry: 'aio_laundry',
  oven: 'oven',
  dishwasher: 'dishwasher',
  microwave: 'microwave',
  freezer: 'freezer',
  tv: 'tv',
};

const BOOKING_APPLIANCE_LABELS = {
  refrigerator: 'Refrigerator',
  washer: 'Washer',
  dryer: 'Dryer',
  aiolaundry: 'AIO Laundry',
  oven: 'Oven / Range',
  dishwasher: 'Dishwasher',
  microwave: 'Microwave',
  freezer: 'Freezer',
  tv: 'TV',
  other: 'Appliance',
};

const FUEL_LABELS = { electric: 'Electric', gas: 'Gas' };

export function bookingNeedsFuel(applianceId) {
  return Boolean(BOOKING_FUEL_OPTIONS[applianceId]);
}

export function resolveBookingEquipmentSubtype(applianceId, fuel = '') {
  if (!applianceId) return null;
  if (bookingNeedsFuel(applianceId)) {
    const match = BOOKING_FUEL_OPTIONS[applianceId]?.find((o) => o.value === fuel);
    return match?.subtype || null;
  }
  return BOOKING_APPLIANCE_SUBTYPE[applianceId] || null;
}

/** Work order equipment_type from booking selection. */
export function resolveBookingEquipmentType(applianceId) {
  if (applianceId === 'tv') return 'tv';
  if (!applianceId || applianceId === 'other') return null;
  return 'appliance';
}

export function formatBookingApplianceLabel(applianceId, { fuel = '', customAppliance = '' } = {}) {
  if (applianceId === 'other' && customAppliance) {
    return customAppliance.trim();
  }
  const base = BOOKING_APPLIANCE_LABELS[applianceId] || applianceId;
  if (bookingNeedsFuel(applianceId) && fuel) {
    const fuelLabel = FUEL_LABELS[fuel] || fuel;
    const short = applianceId === 'dryer' ? 'Dryer' : 'Range';
    return `${fuelLabel} ${short}`;
  }
  return base;
}
