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

/** Complaint + error-code text for keyword / F-code matching in evidence and tips. */
export function getDiagnosticMatchText(fields: Record<string, unknown> = {}): string {
  const raw = [getComplaintText(fields), fields['customer_complaint.error_codes']]
    .filter(Boolean)
    .map((part) => String(part))
    .join(' ');
  return expandErrorCodeTokens(raw);
}

/** Normalize F-codes, Samsung information codes, and display fault names for matching. */
function expandErrorCodeTokens(text: string): string {
  const base = normalizeText(text);
  const extras: string[] = [];
  const source = String(text || '').toLowerCase();
  const fCodeRe = /\bf\s*(\d+)\s*e\s*(\d+)\b/g;
  let match: RegExpExecArray | null;
  while ((match = fCodeRe.exec(source)) !== null) {
    extras.push(`f${match[1]}e${match[2]}`);
  }
  if (base.includes('restricted air')) {
    extras.push('f4e3', 'af', 'not drying', 'restricted air flow');
  }
  if (base.includes('power failure')) {
    extras.push('f6e2', 'no power', 'dead');
  }
  if (/\bl2\b/.test(base) || base.includes('line voltage')) {
    extras.push('f4e4', 'l2', 'no power');
  }

  // Samsung dryer information codes (DV7000R / DVE(G)50R* series) → Whirlpool-equivalent concepts
  if (/\btc5\b/.test(base)) {
    extras.push('f3e3', 'f3e4', 'inlet thermistor', 'restricted air flow', 'not drying');
  } else if (/\btc\b/.test(base)) {
    extras.push('f3e1', 'f3e2', 'exhaust thermistor', 'restricted air flow', 'not drying');
  }
  if (/\bdc\b|\bdf\b/.test(base)) {
    extras.push('door switch', 'no spin', 'door');
  }
  if (/\b9c1\b/.test(base)) {
    extras.push('f4e4', 'supply', 'no power', 'voltage');
  }
  if (/\bac\b/.test(base)) {
    extras.push('f1e1', 'f6e1', 'control', 'error');
  }
  if (/\bhc\b|\bhe\b/.test(base)) {
    extras.push('no heat', 'thermistor', 'f3e1');
  }
  if (/\bfc\b/.test(base)) {
    extras.push('supply', 'frequency', 'no power');
  }
  if (/\bbc2\b/.test(base)) {
    extras.push('f2e1', 'user interface', 'error');
  }

  // Samsung refrigerator codes (SxS service manual + consumer display)
  if (/\b22[ec]\b/.test(base)) {
    extras.push('evap fan', 'frost buildup', 'not cooling', 'weak cooling');
  }
  if (/\b40[ec]\b/.test(base)) {
    extras.push('ice maker', 'evap fan', 'frost');
  }
  if (/\b(5e|8e|14e|21e)\b/.test(base)) {
    extras.push('thermistor', 'sensor', 'defrost');
  }
  if (/\b33e\b/.test(base)) {
    extras.push('ice maker', 'defrost heater');
  }
  if (/\b(41|44|46|47|52)e?r?\b/.test(base)) {
    extras.push('control board', 'communication', 'error');
  }
  if (/\b(84c|86e)\b/.test(base)) {
    extras.push('compressor', 'inverter', 'not cooling', 'sealed system');
  }
  if (/\b(pcer|pc er)\b/.test(base) || base.includes('pc er')) {
    extras.push('door', 'communication', 'hinge');
  }
  if (/\b(ofof|o ff|off)\b/.test(base) && base.includes('cool')) {
    extras.push('demo mode', 'cooling off');
  } else   if (/\b(ofof|o ff)\b/.test(base)) {
    extras.push('demo mode', 'cooling off', 'not cooling');
  }
  if (/\b(cooling off|demo mode|exhibition|showroom)\b/.test(base)) {
    extras.push('cooling off', 'demo mode', 'compressor off');
  }
  if (/\brd\b/.test(base)) {
    extras.push('damper', 'weak cooling', 'airflow');
  }

  return extras.length ? `${base} ${extras.join(' ')}` : base;
}

function hasStructuredErrorCode(text: string): boolean {
  const blob = expandErrorCodeTokens(text);
  if (/\bf\d+e\d+\b/.test(blob)) return true;
  if (/\b(tc5?|9c1|hc|he|fc|bc2|dc|df|ac)\b/.test(blob)) return true;
  return /\b\d{1,2}[ec]\b/.test(blob) || /\b\d{2}er\b/.test(blob) || /\b(pcer|ofof|o ff)\b/.test(blob);
}

export function inferComplaintChipIds(
  text: string,
  chips: ComplaintChipDefinition[] = [],
): string[] {
  const blob = expandErrorCodeTokens(text);
  if (!blob.trim()) return [];
  const matched: string[] = [];
  for (const chip of chips) {
    const idHit = blob.includes(normalizeText(chip.id));
    const labelHit = blob.includes(normalizeText(chip.label));
    const keywordHit = (chip.keywords || []).some((kw) => blob.includes(normalizeText(kw)));
    if (idHit || labelHit || keywordHit) matched.push(chip.id);
  }
  if (
    hasStructuredErrorCode(text) &&
    chips.some((chip) => chip.id === 'error_code') &&
    !matched.includes('error_code')
  ) {
    matched.push('error_code');
  }
  return matched;
}

/** Infer complaint chips from complaint text + error_codes field. */
export function inferComplaintChipIdsFromFields(
  fields: Record<string, unknown> = {},
  chips: ComplaintChipDefinition[] = [],
): string[] {
  return inferComplaintChipIds(getDiagnosticMatchText(fields), chips);
}

/**
 * Pre-select complaint chips when none are chosen yet.
 * Returns true when chips were written to fields.
 */
export function maybeApplyComplaintChipInference(
  fields: Record<string, unknown>,
  chips: ComplaintChipDefinition[] = [],
): boolean {
  if (!chips.length) return false;
  if (getComplaintChipIds(fields).length) return false;
  const inferred = inferComplaintChipIdsFromFields(fields, chips);
  if (!inferred.length) return false;
  fields[COMPLAINT_TAGS_FIELD] = inferred;
  return true;
}

function normalizeText(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
}

function normalizeTriggerKey(trigger: string): string {
  let text = normalizeText(trigger);
  const mentionPrefix = 'complaint mentions ';
  if (text.startsWith(mentionPrefix)) {
    text = text.slice(mentionPrefix.length).replace(/^["']|["']$/g, '').trim();
  }
  return text;
}

function dedupeTriggers(triggers: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const trigger of triggers) {
    const key = normalizeTriggerKey(trigger);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(trigger);
  }
  return result;
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
    triggers: dedupeTriggers(Array.from(triggers)),
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
    triggers: dedupeTriggers(current.triggers),
    matchedRules: current.matchedRules,
  };
}
