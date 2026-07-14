import type { WizardDefinition } from '../types';
import { getDiagnosticTest, listDiagnosticTests } from './testCatalog';

export interface DiagnosticTimelineEvent {
  at: string;
  stepKey: string;
  action: 'entered' | 'completed' | 'field_updated';
  testId?: string;
  fieldKey?: string;
  payload?: Record<string, unknown>;
}

export interface DiagnosticEvidenceSnapshot {
  topCategories?: Array<{ id: string; label: string; evidence: number; rank: number }>;
  matchedRuleCount?: number;
  recommendedStepKeys?: string[];
  capturedAt?: string;
}

const ACTION_LABELS: Record<DiagnosticTimelineEvent['action'], string> = {
  entered: 'Opened step',
  completed: 'Completed step',
  field_updated: 'Updated field',
};

export function appendTimelineEvent(
  timeline: DiagnosticTimelineEvent[] | undefined,
  event: Omit<DiagnosticTimelineEvent, 'at'> & { at?: string },
): DiagnosticTimelineEvent[] {
  const next: DiagnosticTimelineEvent = {
    ...event,
    at: event.at || new Date().toISOString(),
  };
  return [...(timeline || []), next];
}

export function buildEvidenceSnapshot(
  intelligence: import('./evidenceTypes').DiagnosticIntelligenceResult | null | undefined,
): DiagnosticEvidenceSnapshot | null {
  if (!intelligence) return null;
  return {
    topCategories: intelligence.topCategories,
    matchedRuleCount: intelligence.matchedRuleCount,
    recommendedStepKeys: intelligence.recommendedStepKeys,
    capturedAt: new Date().toISOString(),
  };
}

/** Map sectionId.fieldId → wizard stepKey using WizardDefinition metadata. */
export function resolveStepKeyForFieldKey(
  fieldKey: string,
  definition: WizardDefinition | null | undefined,
): string {
  if (!fieldKey || !definition) return 'unknown';
  const sectionId = fieldKey.split('.')[0];
  const step = definition.defaultSteps?.find((s) => s.sectionId === sectionId);
  return step?.stepKey || step?.sectionId || sectionId || 'unknown';
}

export function resolveTestIdForFieldKey(
  templateId: string | null | undefined,
  fieldKey: string,
): string | undefined {
  if (!templateId || !fieldKey) return undefined;
  const match = listDiagnosticTests(templateId).find((t) => t.fieldKey === fieldKey);
  return match?.testId;
}

export function formatTimelineEventTime(at: string): string {
  try {
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) return at;
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  } catch {
    return at;
  }
}

export function formatTimelineEventLabel(
  event: DiagnosticTimelineEvent,
  stepKeyLabels: Record<string, string> = {},
  fieldLabels: Record<string, string> = {},
): string {
  const stepLabel = stepKeyLabels[event.stepKey] || event.stepKey;
  const actionLabel = ACTION_LABELS[event.action] || event.action;

  if (event.action === 'field_updated' && event.fieldKey) {
    const fieldLabel = fieldLabels[event.fieldKey] || event.fieldKey.split('.').pop() || event.fieldKey;
    const value = event.payload?.value;
    const valueSuffix = value != null && String(value).trim() !== '' ? `: ${String(value)}` : '';
    return `${actionLabel} — ${fieldLabel}${valueSuffix}`;
  }

  if (event.testId) {
    const test = getDiagnosticTest(event.testId);
    if (test?.label) {
      return `${actionLabel} — ${test.label}`;
    }
  }

  return `${actionLabel} — ${stepLabel}`;
}

export function groupTimelineByStep(
  timeline: DiagnosticTimelineEvent[] = [],
): Array<{ stepKey: string; events: DiagnosticTimelineEvent[] }> {
  const groups: Array<{ stepKey: string; events: DiagnosticTimelineEvent[] }> = [];
  const indexByStep = new Map<string, number>();

  for (const event of timeline) {
    const existing = indexByStep.get(event.stepKey);
    if (existing != null) {
      groups[existing].events.push(event);
    } else {
      indexByStep.set(event.stepKey, groups.length);
      groups.push({ stepKey: event.stepKey, events: [event] });
    }
  }

  return groups;
}
