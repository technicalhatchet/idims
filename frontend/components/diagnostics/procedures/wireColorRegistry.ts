export interface WireColorDefinition {
  code: string;
  label: string;
  fill: string;
  stroke?: string;
  stripe?: string;
  textOnFill?: string;
}

const WIRE_COLOR_DEFINITIONS: Record<string, WireColorDefinition> = {
  BK: { code: 'BK', label: 'Black', fill: '#1a1a1a', stroke: '#4b5563', textOnFill: '#f9fafb' },
  BLK: { code: 'BLK', label: 'Black', fill: '#1a1a1a', stroke: '#4b5563', textOnFill: '#f9fafb' },
  BL: { code: 'BL', label: 'Blue', fill: '#2563eb', stroke: '#1d4ed8', textOnFill: '#eff6ff' },
  BU: { code: 'BU', label: 'Blue', fill: '#2563eb', stroke: '#1d4ed8', textOnFill: '#eff6ff' },
  BR: { code: 'BR', label: 'Brown', fill: '#92400e', stroke: '#78350f', textOnFill: '#fff7ed' },
  BN: { code: 'BN', label: 'Brown', fill: '#92400e', stroke: '#78350f', textOnFill: '#fff7ed' },
  GN: { code: 'GN', label: 'Green', fill: '#16a34a', stroke: '#15803d', textOnFill: '#f0fdf4' },
  GRN: { code: 'GRN', label: 'Green', fill: '#16a34a', stroke: '#15803d', textOnFill: '#f0fdf4' },
  GY: { code: 'GY', label: 'Gray', fill: '#9ca3af', stroke: '#6b7280', textOnFill: '#111827' },
  GR: { code: 'GR', label: 'Gray', fill: '#9ca3af', stroke: '#6b7280', textOnFill: '#111827' },
  OR: { code: 'OR', label: 'Orange', fill: '#ea580c', stroke: '#c2410c', textOnFill: '#fff7ed' },
  OG: { code: 'OG', label: 'Orange', fill: '#ea580c', stroke: '#c2410c', textOnFill: '#fff7ed' },
  PK: { code: 'PK', label: 'Pink', fill: '#ec4899', stroke: '#db2777', textOnFill: '#fdf2f8' },
  R: { code: 'R', label: 'Red', fill: '#dc2626', stroke: '#b91c1c', textOnFill: '#fef2f2' },
  RD: { code: 'RD', label: 'Red', fill: '#dc2626', stroke: '#b91c1c', textOnFill: '#fef2f2' },
  V: { code: 'V', label: 'Violet', fill: '#7c3aed', stroke: '#6d28d9', textOnFill: '#f5f3ff' },
  VI: { code: 'VI', label: 'Violet', fill: '#7c3aed', stroke: '#6d28d9', textOnFill: '#f5f3ff' },
  W: { code: 'W', label: 'White', fill: '#f3f4f6', stroke: '#9ca3af', textOnFill: '#111827' },
  WH: { code: 'WH', label: 'White', fill: '#f3f4f6', stroke: '#9ca3af', textOnFill: '#111827' },
  WT: { code: 'WT', label: 'White', fill: '#f3f4f6', stroke: '#9ca3af', textOnFill: '#111827' },
  Y: { code: 'Y', label: 'Yellow', fill: '#eab308', stroke: '#ca8a04', textOnFill: '#422006' },
  YL: { code: 'YL', label: 'Yellow', fill: '#eab308', stroke: '#ca8a04', textOnFill: '#422006' },
  'W/B': {
    code: 'W/B',
    label: 'White / Black',
    fill: '#f3f4f6',
    stripe: '#1a1a1a',
    stroke: '#6b7280',
    textOnFill: '#111827',
  },
  'BK/W': {
    code: 'BK/W',
    label: 'Black / White',
    fill: '#1a1a1a',
    stripe: '#f3f4f6',
    stroke: '#6b7280',
    textOnFill: '#f9fafb',
  },
};

export function normalizeWireColorCode(code: string | null | undefined): string {
  return String(code ?? '').trim().toUpperCase();
}

export function resolveWireColor(code: string | null | undefined): WireColorDefinition | null {
  const normalized = normalizeWireColorCode(code);
  if (!normalized) return null;
  return WIRE_COLOR_DEFINITIONS[normalized] ?? null;
}

export function getKnownWireColorCodes(): string[] {
  return Object.keys(WIRE_COLOR_DEFINITIONS).sort();
}
