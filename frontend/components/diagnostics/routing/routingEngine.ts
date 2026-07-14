import type { MeasurementEvaluation } from '../knowledge/types';
import type { DiagnosticWizardStepConfig, WizardDefinition } from '../types';
import { collectClauseTriggers, ruleWhenMatches } from './conditionMatcher';
import type {
  ComplaintChipDefinition,
  RoutingConfig,
  RoutingDiff,
  RoutingEvaluationResult,
} from './types';

export const COMPLAINT_TAGS_FIELD = 'customer_complaint.complaint_tags';

export function getComplaintChipIds(fields: Record<string, unknown> = {}): string[] {
  const raw = fields[COMPLAINT_TAGS_FIELD];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export function getComplaintText(fields: Record<string, unknown> = {}): string {
  return String(fields['customer_complaint.complaint'] || '');
}

export function inferComplaintChipIds(
  text: string,
  chips: ComplaintChipDefinition[] = [],
): string[] {
  const blob = normalizeText(text);
  if (!blob) return [];
  const matched: string[] = [];
  for (const chip of chips) {
    const idHit = blob.includes(normalizeText(chip.id));
    const labelHit = blob.includes(normalizeText(chip.label));
    const keywordHit = (chip.keywords || []).some((kw) => blob.includes(normalizeText(kw)));
    if (idHit || labelHit || keywordHit) matched.push(chip.id);
  }
  return matched;
}

function normalizeText(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
}

function stepKeyForConfig(step: DiagnosticWizardStepConfig): string {
  return step.stepKey || step.sectionId;
}

function buildChipLabelMap(chips: ComplaintChipDefinition[] = []): Record<string, string> {
  return Object.fromEntries(chips.map((c) => [c.id, c.label]));
}

function allStepKeysFromDefinition(definition: WizardDefinition): string[] {
  const keys = definition.defaultSteps.map(stepKeyForConfig);
  const reviewKey = definition.routing?.reviewStepKey || 'review';
  keys.push(reviewKey);
  return keys;
}

function titleForStepKey(definition: WizardDefinition, stepKey: string): string {
  if (stepKey === (definition.routing?.reviewStepKey || 'review')) {
    return definition.reviewStep?.title || 'Review & Save';
  }
  const step = definition.defaultSteps.find((s) => stepKeyForConfig(s) === stepKey);
  return step?.title || stepKey;
}

/**
 * Deterministic routing — no appliance logic; driven entirely by WizardDefinition.routing.
 */
export function evaluateRouting(
  definition: WizardDefinition | null | undefined,
  fields: Record<string, unknown> = {},
  measurementStatuses?: Map<string, MeasurementEvaluation>,
): RoutingEvaluationResult | null {
  if (!definition?.routing) return null;

  const routing = definition.routing;
  const complaintChipIds = getComplaintChipIds(fields);
  const complaintText = getComplaintText(fields);
  const chipLabels = buildChipLabelMap(definition.complaintChips);
  const allStepKeys = allStepKeysFromDefinition(definition);

  const enabled = new Set<string>(routing.alwaysOnStepKeys || []);
  const matchedRules: RoutingEvaluationResult['matchedRules'] = [];
  const triggers = new Set<string>();

  for (const rule of routing.rules || []) {
    if (!ruleWhenMatches(rule.when, complaintChipIds, complaintText, fields, measurementStatuses)) continue;
    matchedRules.push({ ruleId: rule.id, ruleLabel: rule.label || rule.id });
    for (const t of collectClauseTriggers(
      rule.when,
      complaintChipIds,
      complaintText,
      fields,
      chipLabels,
      measurementStatuses,
    )) {
      triggers.add(t);
    }
    for (const key of rule.enable || []) enabled.add(key);
    for (const key of rule.disable || []) enabled.delete(key);
  }

  const reviewKey = routing.reviewStepKey || 'review';
  enabled.add(reviewKey);

  const baseline = new Set(routing.alwaysOnStepKeys || []);
  baseline.add(reviewKey);

  const addedStepKeys: string[] = [];
  const removedStepKeys: string[] = [];

  for (const key of enabled) {
    if (!baseline.has(key)) addedStepKeys.push(key);
  }
  for (const key of allStepKeys) {
    if (!enabled.has(key) && key !== reviewKey) removedStepKeys.push(key);
  }

  return {
    enabledStepKeys: enabled,
    matchedRules,
    triggers: Array.from(triggers),
    addedStepKeys,
    removedStepKeys,
    allStepKeys,
  };
}

export function isStepKeyEnabled(
  routing: RoutingEvaluationResult | null | undefined,
  stepKey: string,
): boolean {
  if (!routing) return true;
  return routing.enabledStepKeys.has(stepKey);
}

export function diffRouting(
  previous: RoutingEvaluationResult | null | undefined,
  current: RoutingEvaluationResult | null | undefined,
  definition: WizardDefinition | null | undefined,
): RoutingDiff | null {
  if (!current || !definition) return null;

  const prevEnabled = previous?.enabledStepKeys || new Set(definition.routing?.alwaysOnStepKeys || []);
  const currEnabled = current.enabledStepKeys;

  const added: RoutingDiff['added'] = [];
  const removed: RoutingDiff['removed'] = [];

  for (const key of currEnabled) {
    if (!prevEnabled.has(key)) {
      added.push({ stepKey: key, title: titleForStepKey(definition, key) });
    }
  }
  for (const key of prevEnabled) {
    if (!currEnabled.has(key)) {
      removed.push({ stepKey: key, title: titleForStepKey(definition, key) });
    }
  }

  if (!added.length && !removed.length && !current.triggers.length) return null;

  return {
    added,
    removed,
    triggers: current.triggers,
    matchedRules: current.matchedRules,
  };
}
