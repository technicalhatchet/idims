import { formatMeasurementDisplay, isOpenCircuitReading, parseMeasurementNumber } from './parseMeasurementValue';
import type {
  MeasurementEvaluation,
  MeasurementInputKind,
  MeasurementKnowledgeDefinition,
  MeasurementRangeSet,
  MeasurementStatus,
  NumericRange,
} from './types';

const SEVERITY_LABELS: Record<MeasurementStatus, string> = {
  normal: 'OK',
  warning: 'Check',
  critical: 'Critical',
  unknown: '—',
  not_tested: 'Not tested',
};

function componentShortName(measurementName: string): string {
  return measurementName
    .replace(/\s+(resistance|ohms|amperage|amps|current|voltage|temperature|continuity|capacitance|pressure|draw)\s*$/i, '')
    .replace(/^hot\s+surface\s+/i, '')
    .trim();
}

function buildDiagnosisLabels(
  definition: MeasurementKnowledgeDefinition,
  status: MeasurementStatus,
  raw: string,
  parsedValue: number | null,
  bandMessage: string,
): { diagnosisLabel: string; severityLabel: string } {
  const shortName = componentShortName(definition.name);
  const severityLabel = SEVERITY_LABELS[status] || '—';

  if (isOpenCircuitReading(raw)) {
    if (definition.openCircuitCritical) {
      const label = shortName ? `Open ${shortName}` : 'Open circuit';
      return { diagnosisLabel: label, severityLabel: 'Critical' };
    }
    return { diagnosisLabel: 'Open reading', severityLabel: 'Check' };
  }

  if (status === 'normal') {
    return { diagnosisLabel: 'Within specification', severityLabel };
  }

  if (status === 'warning') {
    if (definition.inputKind === 'continuity' && parsedValue != null && parsedValue > 5) {
      return { diagnosisLabel: 'High resistance — check contacts', severityLabel };
    }
    if (shortName && definition.inputKind === 'resistance') {
      return { diagnosisLabel: `Borderline ${shortName}`, severityLabel };
    }
    return { diagnosisLabel: 'Out of expected range', severityLabel };
  }

  if (status === 'critical') {
    if (definition.inputKind === 'continuity') {
      return {
        diagnosisLabel: shortName ? `Open ${shortName}` : 'Open or high resistance',
        severityLabel,
      };
    }
    if (definition.inputKind === 'resistance' && parsedValue != null) {
      const ranges = definition.ranges;
      if (ranges?.critical?.below != null && parsedValue < ranges.critical.below) {
        return {
          diagnosisLabel: shortName ? `Shorted ${shortName}` : 'Shorted / very low resistance',
          severityLabel,
        };
      }
      if (ranges?.critical?.above != null && parsedValue > ranges.critical.above) {
        return {
          diagnosisLabel: shortName ? `Open ${shortName}` : 'Open / very high resistance',
          severityLabel,
        };
      }
    }
    if (definition.inputKind === 'current' && parsedValue != null) {
      return {
        diagnosisLabel: bandMessage.includes('Borderline') ? `Weak ${shortName || 'current'}` : `Out of range — ${shortName || 'reading'}`,
        severityLabel,
      };
    }
    if (shortName) {
      return { diagnosisLabel: `Out of range — ${shortName}`, severityLabel };
    }
    return { diagnosisLabel: 'Out of expected range', severityLabel };
  }

  if (status === 'unknown' && !raw) {
    return { diagnosisLabel: 'Not tested', severityLabel };
  }

  return { diagnosisLabel: bandMessage || 'Reading recorded', severityLabel };
}

function withEvaluationMeta(
  definition: MeasurementKnowledgeDefinition,
  base: Omit<MeasurementEvaluation, 'diagnosisLabel' | 'severityLabel' | 'expectedRangeLabel'>,
  bandMessage = base.message,
): MeasurementEvaluation {
  const { diagnosisLabel, severityLabel } = buildDiagnosisLabels(
    definition,
    base.status,
    base.rawValue,
    base.parsedValue,
    bandMessage,
  );
  return {
    ...base,
    diagnosisLabel,
    severityLabel,
    expectedRangeLabel: formatRangeLabel(definition.ranges?.normal, definition.unit) || undefined,
  };
}

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
    return withEvaluationMeta(definition, {
      knowledgeId: definition.id,
      status: 'unknown',
      message: 'Not tested',
      confidence: 'high',
      parsedValue: null,
      rawValue: raw,
      displayUnit,
    });
  }

  const inputKind: MeasurementInputKind = definition.inputKind || 'generic';

  if (inputKind === 'diodeCheck') {
    const result = evaluateDiodeCheck(raw);
    return withEvaluationMeta(definition, {
      knowledgeId: definition.id,
      status: result.status,
      message: result.message,
      confidence: 'low',
      parsedValue: null,
      rawValue: raw,
      displayUnit,
    }, result.message);
  }

  if (inputKind === 'continuity') {
    const result = evaluateContinuity(raw);
    return withEvaluationMeta(definition, {
      knowledgeId: definition.id,
      status: result.status,
      message: result.message,
      confidence: 'high',
      parsedValue: parseMeasurementNumber(raw),
      rawValue: raw,
      displayUnit,
    }, result.message);
  }

  if (isOpenCircuitReading(raw)) {
    const status: MeasurementStatus = definition.openCircuitCritical ? 'critical' : 'warning';
    const message = status === 'critical' ? 'Open circuit (OL)' : 'Open reading';
    return withEvaluationMeta(definition, {
      knowledgeId: definition.id,
      status,
      message,
      confidence: 'high',
      parsedValue: null,
      rawValue: raw,
      displayUnit,
    }, message);
  }

  const parsedValue = parseMeasurementNumber(raw);
  if (parsedValue == null) {
    return withEvaluationMeta(definition, {
      knowledgeId: definition.id,
      status: 'unknown',
      message: 'Could not parse value',
      confidence: 'low',
      parsedValue: null,
      rawValue: raw,
      displayUnit,
    });
  }

  const band = evaluateNumericBands(parsedValue, definition.ranges);
  const formatted = formatMeasurementDisplay(parsedValue, displayUnit);
  return withEvaluationMeta(definition, {
    knowledgeId: definition.id,
    status: band.status,
    message: `${band.message} (${formatted})`,
    confidence: definition.notes?.includes('verify') ? 'medium' : 'high',
    parsedValue,
    rawValue: raw,
    displayUnit,
  }, band.message);
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
