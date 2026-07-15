import { getMeasurementKnowledge } from '../knowledge/knowledgeRegistry';
import { formatRangeLabel } from '../knowledge/measurementRulesEngine';
import type { MeasurementEvaluation } from '../knowledge/types';
import type { EvidenceLedgerTrigger, EvidenceWhenClause } from './evidenceTypes';

export type { EvidenceLedgerTrigger };

const FIELD_VALUE_LABELS: Record<string, string> = {
  yes: 'Yes',
  no: 'No',
  good: 'Good',
  bad: 'Bad',
  normal: 'Normal',
  excessive: 'Excessive',
};

function formatFieldValue(value: unknown): string {
  const text = String(value ?? '').trim();
  return FIELD_VALUE_LABELS[text] || text;
}

function componentShortName(measurementName: string): string {
  return measurementName
    .replace(/\s+(resistance|ohms|amperage|amps|current|voltage|temperature|continuity|capacitance|pressure|draw)\s*$/i, '')
    .replace(/^hot\s+surface\s+/i, '')
    .trim();
}

export function buildLedgerTrigger(
  when: EvidenceWhenClause[],
  fields: Record<string, unknown>,
  measurementStatuses?: Map<string, MeasurementEvaluation>,
  complaintChipLabels?: Record<string, string>,
): EvidenceLedgerTrigger | undefined {
  if (!when?.length) return undefined;

  const clause = when[0];
  if (!clause || typeof clause !== 'object' || !('type' in clause)) return undefined;

  if (clause.type === 'measurement' && clause.knowledgeId) {
    const definition = getMeasurementKnowledge(clause.knowledgeId);
    const evaluation = measurementStatuses?.get(clause.knowledgeId);
    const label = definition?.name || clause.knowledgeId;
    const value = evaluation?.rawValue
      ? `${evaluation.rawValue}${evaluation.displayUnit ? ` ${evaluation.displayUnit}` : ''}`
      : undefined;
    const expectedRange =
      evaluation?.expectedRangeLabel
      || formatRangeLabel(definition?.ranges?.normal, definition?.unit || '')
      || undefined;

    return {
      type: 'measurement',
      label,
      value,
      expectedRange: expectedRange || undefined,
    };
  }

  if (clause.type === 'field' && clause.path) {
    const value = fields[clause.path];
    const pathLabel = clause.path.split('.').pop()?.replace(/_/g, ' ') || clause.path;
    return {
      type: 'field',
      label: pathLabel.replace(/\b\w/g, (c) => c.toUpperCase()),
      value: formatFieldValue(value),
    };
  }

  if (clause.type === 'chip' && clause.id) {
    return {
      type: 'chip',
      label: 'Complaint',
      value: complaintChipLabels?.[clause.id] || clause.id.replace(/_/g, ' '),
    };
  }

  if (clause.type === 'keyword' && clause.match) {
    return {
      type: 'complaint',
      label: 'Complaint keyword',
      value: clause.match,
    };
  }

  return undefined;
}

export function formatLedgerTriggerLine(trigger: EvidenceLedgerTrigger | undefined): string | null {
  if (!trigger) return null;
  if (trigger.type === 'measurement' && trigger.value) {
    const expected = trigger.expectedRange ? ` · Expected ${trigger.expectedRange}` : '';
    return `${trigger.label}: ${trigger.value}${expected}`;
  }
  if (trigger.value) {
    return `${trigger.label}: ${trigger.value}`;
  }
  return trigger.label;
}

/** Rules that only rule out the "OK" half of a hypothesis pair — skip for component ledger/state. */
export function isOppositeOkComponentElimination(
  ruleExplanation: string,
  effect: string,
  targetLayer: string,
): boolean {
  return (
    targetLayer === 'component'
    && effect === 'eliminate'
    && /\b(OK|good|operational)\b.*ruled out/i.test(ruleExplanation)
  );
}

export { componentShortName };
