const OPEN_CIRCUIT_PATTERNS = /^(ol|o\.?l\.?|open|∞|inf(inity)?|--|-)$/i;

export function isOpenCircuitReading(raw: string): boolean {
  return OPEN_CIRCUIT_PATTERNS.test(String(raw || '').trim());
}

/** Parse technician entry — tolerates trailing units and commas. */
export function parseMeasurementNumber(raw: unknown): number | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text || isOpenCircuitReading(text)) return null;
  const normalized = text.replace(/,/g, '').replace(/[^\d.+-]/g, (match, offset, full) => {
    if (offset === 0 && (match === '+' || match === '-')) return match;
    return '';
  });
  if (!normalized || normalized === '+' || normalized === '-') return null;
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

export function formatMeasurementDisplay(value: number, unit: string): string {
  const abs = Math.abs(value);
  if (unit === 'Ω' && abs >= 1000) {
    const k = value / 1000;
    return `${k < 10 ? k.toFixed(2) : k.toFixed(1)} kΩ`;
  }
  if (abs >= 100) return `${value.toFixed(0)} ${unit}`.trim();
  if (abs >= 10) return `${value.toFixed(1)} ${unit}`.trim();
  return `${value.toFixed(2)} ${unit}`.trim();
}
