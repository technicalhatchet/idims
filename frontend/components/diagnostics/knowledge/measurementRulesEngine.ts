import { formatMeasurementDisplay, isOpenCircuitReading, parseMeasurementNumber } from './parseMeasurementValue';
import type {
  MeasurementEvaluation,
  MeasurementInputKind,
  MeasurementKnowledgeDefinition,
  MeasurementRangeSet,
  MeasurementStatus,
  NumericRange,
} from './types';

function valueInRange(value: number, range?: NumericRange): boolean {
  if (!range) return false;
  if (range.min != null && value < range.min) return false;
  if (range.max != null && value > range.max) return false;
  if (range.below != null && value < range.below) return false;
  if (range.above != null && value > range.above) return false;
  return true;
}

function rangeViolated(value: number, range?: NumericRange): boolean {
  if (!range) return false;
  if (range.below != null && value < range.below) return true;
  if (range.above != null && value > range.above) return true;
  if (range.min != null && value < range.min) return true;
  if (range.max != null && value > range.max) return true;
  return false;
}

function evaluateNumericBands(
  value: number,
  ranges: MeasurementRangeSet | undefined,
): { status: MeasurementStatus; message: string } {
  if (ranges?.critical && rangeViolated(value, ranges.critical)) {
    return { status: 'critical', message: 'Outside critical limits' };
  }
  if (ranges?.warning && rangeViolated(value, ranges.warning) && !valueInRange(value, ranges.normal)) {
    return { status: 'warning', message: 'Borderline — verify and compare to spec' };
  }
  if (ranges?.normal && valueInRange(value, ranges.normal)) {
    return { status: 'normal', message: 'Within expected range' };
  }
  if (ranges?.warning && valueInRange(value, ranges.warning)) {
    return { status: 'warning', message: 'Borderline — verify and compare to spec' };
  }
  return { status: 'unknown', message: 'No matching range band' };
}

function evaluateContinuity(raw: string): { status: MeasurementStatus; message: string } {
  if (!String(raw || '').trim()) {
    return { status: 'unknown', message: 'Not tested' };
  }
  if (isOpenCircuitReading(raw)) {
    return { status: 'critical', message: 'Open circuit' };
  }
  const value = parseMeasurementNumber(raw);
  if (value == null) {
    return { status: 'unknown', message: 'Could not parse reading' };
  }
  if (value <= 5) {
    return { status: 'normal', message: 'Continuity OK' };
  }
  if (value <= 20) {
    return { status: 'warning', message: 'High resistance — check contacts' };
  }
  return { status: 'critical', message: 'Open or high resistance' };
}

function evaluateDiodeCheck(_raw: string): { status: MeasurementStatus; message: string } {
  return { status: 'unknown', message: 'Use diode test procedure — directional check' };
}

export function evaluateMeasurement(
  definition: MeasurementKnowledgeDefinition | null | undefined,
  rawValue: unknown,
): MeasurementEvaluation | null {
  if (!definition) return null;

  const raw = String(rawValue ?? '').trim();
  const displayUnit = definition.unit || '';

  if (!raw) {
    return {
      knowledgeId: definition.id,
      status: 'unknown',
      message: 'Not tested',
      confidence: 'high',
      parsedValue: null,
      rawValue: raw,
      displayUnit,
    };
  }

  const inputKind: MeasurementInputKind = definition.inputKind || 'generic';

  if (inputKind === 'diodeCheck') {
    const result = evaluateDiodeCheck(raw);
    return {
      knowledgeId: definition.id,
      status: result.status,
      message: result.message,
      confidence: 'low',
      parsedValue: null,
      rawValue: raw,
      displayUnit,
    };
  }

  if (inputKind === 'continuity') {
    const result = evaluateContinuity(raw);
    return {
      knowledgeId: definition.id,
      status: result.status,
      message: result.message,
      confidence: 'high',
      parsedValue: parseMeasurementNumber(raw),
      rawValue: raw,
      displayUnit,
    };
  }

  if (isOpenCircuitReading(raw)) {
    const status: MeasurementStatus = definition.openCircuitCritical ? 'critical' : 'warning';
    return {
      knowledgeId: definition.id,
      status,
      message: status === 'critical' ? 'Open circuit (OL)' : 'Open reading',
      confidence: 'high',
      parsedValue: null,
      rawValue: raw,
      displayUnit,
    };
  }

  const parsedValue = parseMeasurementNumber(raw);
  if (parsedValue == null) {
    return {
      knowledgeId: definition.id,
      status: 'unknown',
      message: 'Could not parse value',
      confidence: 'low',
      parsedValue: null,
      rawValue: raw,
      displayUnit,
    };
  }

  const band = evaluateNumericBands(parsedValue, definition.ranges);
  const formatted = formatMeasurementDisplay(parsedValue, displayUnit);
  return {
    knowledgeId: definition.id,
    status: band.status,
    message: `${band.message} (${formatted})`,
    confidence: definition.notes?.includes('verify') ? 'medium' : 'high',
    parsedValue,
    rawValue: raw,
    displayUnit,
  };
}

export function formatRangeLabel(range?: NumericRange, unit = ''): string | null {
  if (!range) return null;
  if (range.min != null && range.max != null) {
    return `${range.min}–${range.max} ${unit}`.trim();
  }
  if (range.below != null && range.above != null) {
    return `<${range.below} or >${range.above} ${unit}`.trim();
  }
  if (range.below != null) return `< ${range.below} ${unit}`.trim();
  if (range.above != null) return `> ${range.above} ${unit}`.trim();
  return null;
}
