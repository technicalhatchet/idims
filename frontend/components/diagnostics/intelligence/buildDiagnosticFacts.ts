import { getComplaintChipIds } from '../routing/routingEngine';
import type { MeasurementEvaluation } from '../knowledge/types';
import { listDiagnosticTests } from './testCatalog';
import { buildAutoNoteBullets } from './buildAutoNoteBullets';
import { computeDiagnosisConfidence } from './evidenceDisplay';
import type {
  DiagnosticIntelligenceResult,
  EvidenceConfig,
  EvidenceLedgerEntry,
} from './evidenceTypes';

const VALUE_LABELS: Record<string, string> = {
  yes: 'Yes',
  no: 'No',
  good: 'Good',
  bad: 'Bad',
  normal: 'Normal',
  excessive: 'Excessive',
  not_checked: 'Not checked',
};

function formatFieldValue(value: unknown): string {
  const text = String(value ?? '').trim();
  return VALUE_LABELS[text] || text;
}

function isMeaningfulFieldValue(value: unknown): boolean {
  const text = String(value ?? '').trim();
  return Boolean(text) && text !== 'not_checked';
}

function formatMeasurementLine(
  knowledgeId: string,
  measurementStatuses?: Map<string, MeasurementEvaluation>,
): string | null {
  const evaluation = measurementStatuses?.get(knowledgeId);
  if (!evaluation) return null;
  const test = listDiagnosticTests().find((entry) => entry.knowledgeId === knowledgeId);
  const label = test?.label || knowledgeId;
  const valueText = evaluation.rawValue
    ? `${evaluation.rawValue}${evaluation.displayUnit ? ` ${evaluation.displayUnit}` : ''}`
    : '—';
  const statusNote =
    evaluation.diagnosisLabel
    || (evaluation.status === 'normal'
      ? 'normal range'
      : evaluation.status === 'warning'
        ? 'out of range'
        : evaluation.status === 'critical'
          ? evaluation.message || 'critical'
          : evaluation.message || evaluation.status);
  return `${label}: ${valueText} — ${statusNote}`;
}

function collectMeasurements(
  templateId: string,
  measurementStatuses?: Map<string, MeasurementEvaluation>,
): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const test of listDiagnosticTests(templateId)) {
    if (!test.knowledgeId) continue;
    const line = formatMeasurementLine(test.knowledgeId, measurementStatuses);
    if (line && !seen.has(line)) {
      seen.add(line);
      lines.push(line);
    }
  }

  return lines;
}

function collectObservations(args: {
  templateId: string;
  fields: Record<string, unknown>;
  fieldLabels?: Record<string, string>;
}): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const test of listDiagnosticTests(args.templateId)) {
    if (test.knowledgeId || !test.fieldKey) continue;
    const value = args.fields[test.fieldKey];
    if (!isMeaningfulFieldValue(value)) continue;

    const label = args.fieldLabels?.[test.fieldKey] || test.label || test.fieldKey;
    const line = `${label}: ${formatFieldValue(value)}`;
    if (!seen.has(line)) {
      seen.add(line);
      lines.push(line);
    }
  }

  return lines;
}

function collectComponentStates(
  intelligence: DiagnosticIntelligenceResult,
): Array<{ label: string; state: string }> {
  const states: Array<{ label: string; state: string }> = [];

  for (const components of Object.values(intelligence.componentsByCategory || {})) {
    for (const component of components) {
      if (component.state === 'unknown') continue;
      states.push({ label: component.label, state: component.state });
    }
  }

  return states;
}

function collectEvidenceLines(
  intelligence: DiagnosticIntelligenceResult,
  ledgerLimit = 5,
): string[] {
  const lines: string[] = [];

  for (const category of intelligence.topCategories || []) {
    if (category.evidence > 0) {
      lines.push(`${category.label}: evidence score ${category.evidence}`);
    }
  }

  const ledgerLines = (intelligence.ledger || [])
    .filter((entry: EvidenceLedgerEntry) => entry.source !== 'dma')
    .filter((entry) => entry.effect === 'increase' || entry.effect === 'confirm' || entry.effect === 'eliminate')
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, ledgerLimit)
    .map((entry) => entry.explanation);

  for (const line of ledgerLines) {
    if (!lines.includes(line)) lines.push(line);
  }

  return lines;
}

export interface DiagnosticFactsPayload {
  templateLabel: string;
  equipmentSubtype?: string;
  complaintChips: string[];
  complaintText?: string;
  measurements: string[];
  observations: string[];
  componentStates: Array<{ label: string; state: string }>;
  evidenceLines: string[];
  confidence?: { tier: string; percent: number; explanation: string };
  deterministicBullets: string[];
}

export function buildDiagnosticFacts(args: {
  templateId: string;
  templateLabel: string;
  equipmentSubtype?: string | null;
  fields: Record<string, unknown>;
  complaintChips?: Array<{ id: string; label: string }>;
  config: EvidenceConfig;
  intelligence: DiagnosticIntelligenceResult;
  measurementStatuses?: Map<string, MeasurementEvaluation>;
  fieldLabels?: Record<string, string>;
  stepKeyLabels?: Record<string, string>;
}): DiagnosticFactsPayload {
  const chipIds = getComplaintChipIds(args.fields);
  const complaintChipLabels = chipIds
    .map((id) => args.complaintChips?.find((chip) => chip.id === id)?.label || id)
    .filter(Boolean);

  const complaintText = String(args.fields['customer_complaint.complaint'] ?? '').trim() || undefined;
  const confidence = computeDiagnosisConfidence(args.intelligence);

  const deterministicBullets = buildAutoNoteBullets({
    templateId: args.templateId,
    fields: args.fields,
    complaintChipIds: chipIds,
    complaintChips: args.complaintChips,
    config: args.config,
    intelligence: args.intelligence,
    measurementStatuses: args.measurementStatuses,
    fieldLabels: args.fieldLabels,
    stepKeyLabels: args.stepKeyLabels,
  });

  return {
    templateLabel: args.templateLabel,
    equipmentSubtype: args.equipmentSubtype?.trim() || undefined,
    complaintChips: complaintChipLabels,
    complaintText: complaintChipLabels.length ? undefined : complaintText,
    measurements: collectMeasurements(args.templateId, args.measurementStatuses),
    observations: collectObservations({
      templateId: args.templateId,
      fields: args.fields,
      fieldLabels: args.fieldLabels,
    }),
    componentStates: collectComponentStates(args.intelligence),
    evidenceLines: collectEvidenceLines(args.intelligence),
    confidence: confidence
      ? {
        tier: confidence.tier,
        percent: confidence.percent,
        explanation: confidence.explanation,
      }
      : undefined,
    deterministicBullets,
  };
}
