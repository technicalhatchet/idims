import { techDmaPath } from '../lib/techRoutes';

export const DMA_EQUIPMENT_SUBTYPE_LABELS = {
  washing_machine: 'Washing Machine',
  electric_dryer: 'Electric Dryer',
  gas_dryer: 'Gas Dryer',
  dryer: 'Dryer',
  refrigerator: 'Refrigerator',
  freezer: 'Freezer',
  dishwasher: 'Dishwasher',
  electric_range: 'Electric Range',
  gas_range: 'Gas Range',
  oven: 'Oven / Range',
  aio_laundry: 'AIO Laundry',
  microwave: 'Microwave',
  cooktop: 'Cooktop',
  range_hood: 'Range Hood',
  other: 'Other',
};

export function formatDmaSubtype(subtype) {
  if (!subtype) return '';
  return DMA_EQUIPMENT_SUBTYPE_LABELS[subtype] || subtype.replace(/_/g, ' ');
}

export const DMA_CANONICAL_MANUFACTURERS = [
  'Whirlpool',
  'Samsung',
  'LG',
  'GE',
  'Frigidaire',
  'Bosch',
];

export const DMA_MANUFACTURER_ALIASES = {
  Maytag: 'Whirlpool',
  KitchenAid: 'Whirlpool',
  Amana: 'Whirlpool',
  JennAir: 'Whirlpool',
  Hotpoint: 'GE',
  Cafe: 'GE',
  Electrolux: 'Frigidaire',
};

export function resolveCanonicalManufacturer(make) {
  if (!make) return '';
  const trimmed = make.trim();
  if (DMA_CANONICAL_MANUFACTURERS.includes(trimmed)) return trimmed;
  return DMA_MANUFACTURER_ALIASES[trimmed] || trimmed;
}

export function buildDmaRepairSearchHref({ make, subtype, errorCode } = {}) {
  const q = {};
  if (make) q.make = make;
  if (subtype) q.subtype = subtype;
  if (errorCode) q.error = errorCode;
  return techDmaPath('', q);
}

export function buildDmaErrorCodeSearchHref({ make, subtype, code } = {}) {
  const q = {};
  if (make) q.make = make;
  if (subtype) q.subtype = subtype;
  if (code) q.code = code;
  return techDmaPath('codes', q);
}
