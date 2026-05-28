export const DMA_EQUIPMENT_SUBTYPE_LABELS = {
  washing_machine: 'Washing Machine',
  dryer: 'Dryer',
  refrigerator: 'Refrigerator',
  dishwasher: 'Dishwasher',
  oven: 'Oven / Range',
  microwave: 'Microwave',
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
  const query = new URLSearchParams();
  if (make) query.set('make', make);
  if (subtype) query.set('subtype', subtype);
  if (errorCode) query.set('error', errorCode);
  const qs = query.toString();
  return `/techdashboard/dma${qs ? `?${qs}` : ''}`;
}

export function buildDmaErrorCodeSearchHref({ make, subtype, code } = {}) {
  const query = new URLSearchParams();
  if (make) query.set('make', make);
  if (subtype) query.set('subtype', subtype);
  if (code) query.set('code', code);
  const qs = query.toString();
  return `/techdashboard/dma/codes${qs ? `?${qs}` : ''}`;
}
