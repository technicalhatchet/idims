import { getComplaintChipIds } from '../routing/routingEngine';
import type { MeasurementEvaluation } from '../knowledge/types';
import { listDiagnosticTests } from './testCatalog';
import { resolveStepKeyLabel } from './stepKeyLabels';
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

function formatLedgerBullet(entry: EvidenceLedgerEntry): string {
  const sign = entry.delta > 0 ? `+${entry.delta}` : String(entry.delta);
  return `${sign} ${entry.explanation}`;
}

function collectTestResultBullets(args: {
  templateId: string;
  fields: Record<string, unknown>;
  fieldLabels?: Record<string, string>;
  measurementStatuses?: Map<string, MeasurementEvaluation>;
}): string[] {
  const bullets: string[] = [];
  const seen = new Set<string>();

  for (const test of listDiagnosticTests(args.templateId)) {
    if (test.knowledgeId) {
      const line = formatMeasurementLine(test.knowledgeId, args.measurementStatuses);
      if (line && !seen.has(line)) {
        seen.add(line);
        bullets.push(line);
      }
      continue;
    }

    if (!test.fieldKey) continue;
    const value = args.fields[test.fieldKey];
    if (!isMeaningfulFieldValue(value)) continue;

    const label = args.fieldLabels?.[test.fieldKey] || test.label || test.fieldKey;
    const line = `${label}: ${formatFieldValue(value)}`;
    if (!seen.has(line)) {
      seen.add(line);
      bullets.push(line);
    }
  }

  return bullets;
}

function collectLedgerHighlightBullets(
  ledger: EvidenceLedgerEntry[],
  limit = 3,
): string[] {
  const highlights = ledger
    .filter((entry) => entry.source !== 'dma')
    .filter((entry) => entry.effect === 'increase' || entry.effect === 'confirm' || entry.effect === 'eliminate')
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit)
    .map(formatLedgerBullet);

  return highlights;
}

function collectDmaBullets(ledger: EvidenceLedgerEntry[]): string[] {
  return ledger
    .filter((entry) => entry.source === 'dma' && entry.delta > 0)
    .map(formatLedgerBullet);
}

function collectComponentStatusBullets(
  intelligence: DiagnosticIntelligenceResult,
): string[] {
  const bullets: string[] = [];
  const confirmed: string[] = [];
  const eliminated: string[] = [];

  for (const components of Object.values(intelligence.componentsByCategory || {})) {
    for (const component of components) {
      if (component.state === 'confirmed') confirmed.push(component.label.toLowerCase());
      if (component.state === 'eliminated') eliminated.push(component.label.toLowerCase());
    }
  }

  if (confirmed.length) {
    bullets.push(`Confirmed: ${confirmed.join(', ')}`);
  }
  if (eliminated.length) {
    bullets.push(`Ruled out: ${eliminated.join(', ')}`);
  }

  return bullets;
}

export function buildAutoNoteBullets(args: {
  templateId: string;
  fields: Record<string, unknown>;
  complaintChipIds?: string[];
  complaintChips?: Array<{ id: string; label: string }>;
  config: EvidenceConfig;
  intelligence: DiagnosticIntelligenceResult;
  measurementStatuses?: Map<string, MeasurementEvaluation>;
  fieldLabels?: Record<string, string>;
  stepKeyLabels?: Record<string, string>;
}): string[] {
  const { fields, intelligence, measurementStatuses, fieldLabels, stepKeyLabels } = args;
  const chipIds = args.complaintChipIds || getComplaintChipIds(fields);
  const bullets: string[] = [];

  if (chipIds.length && args.complaintChips?.length) {
    const labels = chipIds
      .map((id) => args.complaintChips?.find((chip) => chip.id === id)?.label || id)
      .join(', ');
    bullets.push(`Customer complaint: ${labels}`);
  } else if (fields['customer_complaint.complaint']) {
    bullets.push(`Customer complaint: ${String(fields['customer_complaint.complaint']).trim()}`);
  }

  bullets.push(
    ...collectTestResultBullets({
      templateId: args.templateId,
      fields,
      fieldLabels,
      measurementStatuses,
    }),
  );

  const ledgerHighlights = collectLedgerHighlightBullets(intelligence.ledger || []);
  bullets.push(...ledgerHighlights);

  if (intelligence.topCategories.length) {
    const scores = intelligence.topCategories
      .map((category) => `${category.label} (${category.evidence})`)
      .join(', ');
    bullets.push(`Diagnostic evidence: ${scores}`);
  }

  bullets.push(...collectDmaBullets(intelligence.ledger || []));
  bullets.push(...collectComponentStatusBullets(intelligence));

  const topCategory = intelligence.topCategories[0];
  if (topCategory) {
    const components = intelligence.componentsByCategory[topCategory.id] || [];
    const confirmed = components.find((component) => component.state === 'confirmed');
    if (confirmed) {
      bullets.push(
        `Leading hypothesis: ${topCategory.label} — ${confirmed.label.toLowerCase()} confirmed`,
      );
    } else if (topCategory.evidence >= 30) {
      bullets.push(`Leading hypothesis: ${topCategory.label} — evidence score ${topCategory.evidence}`);
    }
  }

  const nextStepKey = intelligence.recommendedStepKeys?.[0];
  if (nextStepKey) {
    const stepLabel = resolveStepKeyLabel(nextStepKey, stepKeyLabels);
    if (stepLabel) {
      bullets.push(`Suggested next step: ${stepLabel}`);
    }
  }

  // De-dupe while preserving order.
  const seen = new Set<string>();
  return bullets.filter((bullet) => {
    if (seen.has(bullet)) return false;
    seen.add(bullet);
    return true;
  });
}
