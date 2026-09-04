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

  // LG refrigerator codes (LRMVS3006* / InstaView 4-door) — display shows e.g. F dH, E rF, FF
  if (/\b(f|r)\s*d[h]\b/.test(base) || /\b(f|r)dh\b/.test(base)) {
    extras.push('defrost heater', 'defrost', 'frost buildup');
  }
  if (/\b(f|r)\s*d[s]\b/.test(base) || /\b(f|r)ds\b/.test(base)) {
    extras.push('defrost', 'thermistor', 'sensor');
  }
  if (/\b(e\s*)?ff\b/.test(base) && !base.includes('coffee')) {
    extras.push('evap fan', 'freezer fan', 'frost buildup', 'not cooling');
  }
  if (/\b(e\s*)?rf\b/.test(base)) {
    extras.push('evap fan', 'airflow', 'weak cooling');
  }
  if (/\b(e\s*)?if\b/.test(base) || /\b(e\s*)?er\b/.test(base)) {
    extras.push('ice maker', 'evap fan', 'frost');
  }
  if (/\b(e\s*)?cf\b/.test(base)) {
    extras.push('condenser fan', 'airflow', 'not cooling');
  }
  if (/\b(e\s*)?co\b/.test(base)) {
    extras.push('control board', 'communication', 'display panel');
  }
  if (/\b(e\s*)?ch\b/.test(base)) {
    extras.push('sealed system', 'compressor', 'refrigerant leak');
  }
  if (/\b(e\s*)?cl\b/.test(base)) {
    extras.push('sealed system', 'compressor', 'refrigerant leak');
  }
  if (/\b(e\s*)?fs\b/.test(base)) {
    extras.push('thermistor', 'freezer', 'sensor');
  }
  if (/\b(e\s*)?rs\b/.test(base)) {
    extras.push('thermistor', 'sensor', 'fresh food');
  }
  if (/\b(e\s*)?is\b/.test(base)) {
    extras.push('ice maker', 'thermistor', 'sensor');
  }
  if (/\b(e\s*)?cs\b/.test(base)) {
    extras.push('thermistor', 'convert drawer', 'sensor');
  }
  if (/\b(e\s*)?od\b/.test(base)) {
    extras.push('wifi', 'control board', 'communication');
  }
  if (/\bdisplay mode\b/.test(base) || (/\boff\b/.test(base) && base.includes('display'))) {
    extras.push('demo mode', 'cooling off', 'not cooling');
  }

  // Whirlpool top-mount refrigerator (W10330404 / WRT family) — mechanical + electronic codes
  if (/\b(rd|df)\b/.test(base)) {
    extras.push('defrost heater', 'defrost', 'frost buildup');
  }
  if (/\bptc\b/.test(base) || /\bptcopen\b/.test(base)) {
    extras.push('compressor', 'start device', 'compressor wont start');
  }
  if (/\b(im\s*fuse|imfuse)\b/.test(base)) {
    extras.push('ice maker', 'no ice');
  }
  if (/\btimer\b/.test(base) && base.includes('defrost')) {
    extras.push('defrost', 'frost buildup');
  }
  if (/\bcontrol\s*off\b/.test(base) || /\bcontroloff\b/.test(base)) {
    extras.push('not cooling', 'cold control');
  }
  if (/\b(ol|overload)\b/.test(base) && (base.includes('compressor') || base.includes('comp'))) {
    extras.push('compressor wont start', 'ptc');
  }
  if (/\b(e\s*)?[0-9]\b/.test(base) && /\b(e0|e1|e2|e3|e5|e6|e9|f0|f1|f2|f3|f5|f6|f9)\b/.test(base)) {
    extras.push('error code', 'thermistor', 'defrost');
  }
  if (/\bdefrost\b/.test(base) && /\b(cycle|progress|in progress)\b/.test(base)) {
    extras.push('running often', 'not cooling');
  }
  if (/\btemperature control\b/.test(base) && /\boff\b/.test(base)) {
    extras.push('not cooling', 'cold control');
  }
  if (/\badc\b/.test(base) || /\badc2000\b/.test(base) || /\badc test\b/.test(base)) {
    extras.push('defrost', 'frost buildup', 'defrost heater');
  }
  if (/\bwrt311\b/.test(base)) {
    extras.push('defrost', 'compressor', 'not cooling');
  }

  // Whirlpool front-load washer (W11169652 / direct-drive ACU)
  if (/\bf0e5\b|\bob\b/.test(base)) {
    extras.push('vibration', 'off balance', 'unbalance', 'wont spin');
  }
  if (/\bf0e2\b|\bsd\b/.test(base)) {
    extras.push('oversuds', 'he detergent', 'no spin');
  }
  if (/\bf5e4\b|\bdr\b/.test(base)) {
    extras.push('door lock', 'lid lock', 'f5e1');
  }
  if (/\bf8e1\b|\blo fl\b/.test(base)) {
    extras.push('no fill', 'long fill', 'fill', 'inlet');
  }
  if (/\bf9e1\b/.test(base)) {
    extras.push('wont drain', 'long drain', 'drain', 'nd');
  }
  if (/\bf5e[123]\b/.test(base)) {
    extras.push('door lock', 'lid lock');
  }
  if (/\bf7e[289]\b|\bf7ea\b|\bf7ec\b/.test(base)) {
    extras.push('wont spin', 'motor', 'drive motor');
  }
  if (/\bf3e1\b/.test(base)) {
    extras.push('pressure switch', 'fill', 'no fill');
  }
  if (/\bf4e[124]\b/.test(base)) {
    extras.push('no heat', 'heater', 'wash heater');
  }
  if (/\bf6e[123]\b/.test(base)) {
    extras.push('control board', 'communication', 'error');
  }
  if (/\bfce0\b/.test(base)) {
    extras.push('wifi', 'control board', 'communication');
  }
  // Insignia top-load washer E/F codes (avoid F8E* dishwasher overlap via word boundaries)
  if (/\be4\b/.test(base) && !/\bf4e/.test(base)) {
    extras.push('vibration', 'unbalance', 'off balance');
  }
  if (/\bf8\b/.test(base) && !/\bf8e/.test(base)) {
    extras.push('level sensor', 'fill', 'no fill');
  }
  if (/\bfd\b/.test(base)) {
    extras.push('door lock', 'lid lock');
  }
  if (/\bf5\b/.test(base) && !/\bf5e/.test(base)) {
    extras.push('load sensing', 'belt');
  }

  // Midea / Insignia refrigerator & freezer E-family
  if (/\be0\b/.test(base) && !/\bf0e/.test(base)) {
    extras.push('ice maker', 'no ice');
  }
  if (/\be1\b/.test(base) && !/\bf1e/.test(base) && !/\be1[0-9]/.test(base)) {
    extras.push('thermistor', 'fresh food', 'refrigerator sensor');
  }
  if (/\be2\b/.test(base) && !/\bf2e/.test(base) && !/\be2[0-9]/.test(base)) {
    extras.push('thermistor', 'freezer', 'sensor');
  }
  if (/\be4\b/.test(base) && !/\bf4e/.test(base)) {
    extras.push('defrost', 'thermistor', 'refrigerator');
  }
  if (/\be5\b/.test(base) && !/\bf5e/.test(base)) {
    extras.push('defrost', 'thermistor', 'freezer');
  }
  if (/\be6\b/.test(base) && !/\bf6e/.test(base)) {
    extras.push('communication', 'display panel', 'control board');
  }
  if (/\be7\b/.test(base) && !/\bf7e/.test(base)) {
    extras.push('thermistor', 'ambient', 'sensor');
  }
  if (/\be9\b/.test(base) && !/\bf9e/.test(base)) {
    extras.push('not cooling', 'high temp', 'door gasket');
  }
  if (/\bee\b/.test(base)) {
    extras.push('ice maker', 'thermistor', 'sensor');
  }
  if (/\bep\b/.test(base)) {
    extras.push('ice maker');
  }
  // Frigidaire Professional Er t*
  if (/\ber\s*t1\b|\bert1\b/.test(base)) {
    extras.push('thermistor', 'freezer', 'sensor');
  }
  if (/\ber\s*t[23]\b|\bert[23]\b/.test(base)) {
    extras.push('thermistor', 'fresh food', 'sensor');
  }
  if (/\ber\s*t5\b|\bert5\b/.test(base)) {
    extras.push('thermistor', 'convert drawer', 'sensor');
  }
  if (/\ber\s*t6\b|\bert6\b/.test(base)) {
    extras.push('ice maker', 'thermistor', 'tray sensor');
  }
  if (/\ber\s*ce\b|\berce\b/.test(base)) {
    extras.push('communication', 'display panel', 'ui');
  }
  if (/\bdemo\b/.test(base) && base.includes('show')) {
    extras.push('demo mode', 'cooling off', 'not cooling');
  }
  // Whirlpool/KitchenAid ice maker service codes (test 56) + modular 2225623
  if (/\bice\s*e1\b|\be1\s*ice\b/.test(base)) {
    extras.push('ice maker', 'no cooling', 'sealed system');
  }
  if (/\bice\s*e2\b|\be2\s*ice\b|\b8800\b/.test(base)) {
    extras.push('ice maker', 'motor', 'harvest');
  }
  if (/\bice\s*e3\b|\be3\s*ice\b/.test(base) && base.includes('ice')) {
    extras.push('ice maker', 'mold heater', '72');
  }
  if (/\bdry cycle\b/.test(base) || (/\be4\b/.test(base) && base.includes('ice'))) {
    extras.push('ice maker', 'water valve', 'fill', 'no ice');
  }
  if (/\bice\s*e5\b|\be5\s*ice\b/.test(base)) {
    extras.push('ice maker', 'thermistor', 'sensor');
  }
  if (/\btest\s*56\b|\b2225623\b|\bmodular ice\b/.test(base)) {
    extras.push('ice maker', 'module test', 'harvest');
  }
  if (/\b72\s*ohm\b/.test(base) && base.includes('ice')) {
    extras.push('ice maker', 'mold heater');
  }

  // Dishwasher ACU / Insignia / LG
  if (/\bf3e2\b/.test(base)) {
    extras.push('owi', 'calibration', 'not cleaning');
  }
  if (/\bf7e4\b/.test(base)) {
    extras.push('rif filter', 'not cleaning', 'filter');
  }
  if (/\bf10e5\b|\bfae5\b/.test(base)) {
    extras.push('leak', 'diverter', 'leaking');
  }
  if (/\bvario\b/.test(base)) {
    extras.push('wash', 'top rack', 'diverter');
  }
  if (/\be8\b/.test(base) && !/\bf8e/.test(base)) {
    extras.push('diverter', 'top rack', 'wash');
  }
  if (/\bae\b/.test(base) && !/\bfae/.test(base)) {
    extras.push('leak', 'leaking', 'overflow');
  }
  if (/\bbe\b/.test(base)) {
    extras.push('suds', 'detergent', 'bubble');
  }
  if (/\bed\b/.test(base) && !/\bfed/.test(base)) {
    extras.push('display panel', 'communication', 'dead');
  }

  // Insignia dryer + LG duct codes
  if (/\bd80\b|\bd85\b|\bd90\b|\bd95\b/.test(base)) {
    extras.push('not drying', 'vent restriction', 'restricted air', 'af');
  }
  if (/\bc9\b/.test(base) && !/\b9c/.test(base)) {
    extras.push('communication', 'control board', 'dead');
  }

  // LG microwave OTR
  if (/\bf-1\b|\bf-2\b/.test(base)) {
    extras.push('no heat', 'thermistor', 'pcb');
  }
  if (/\bf-4\b/.test(base)) {
    extras.push('sensor', 'humidity');
  }

  // Samsung FlexWash dual-load (WV55M9600*)
  if (/\bac7\b/.test(base)) {
    extras.push('flexwash', 'upper washer', 'communication', 'control board');
  }
  if (/\bdc4\b/.test(base)) {
    extras.push('flexwash upper', 'door lock', 'lid lock', 'upper door');
  }
  if (/\b4c2\b/.test(base)) {
    extras.push('hot cold hose', 'fill', 'no fill', 'water supply');
  }
  if (/\bac6\b/.test(base)) {
    extras.push('inverter', 'motor', 'wont spin', 'drive motor');
  }
  if (/\btc4\b/.test(base)) {
    extras.push('inverter', 'motor', 'overheat');
  }
  if (/\bsf\b/.test(base) && !/\bsf6/.test(base)) {
    extras.push('system fault', 'control board', 'main pcb');
  }
  if (/\bdc1\b/.test(base)) {
    extras.push('door lock', 'lid lock');
  }
  if (/\bbc2\b/.test(base)) {
    extras.push('stuck button', 'user interface');
  }

  // GE GUD27 / unitized laundry center — mechanical timer dryer (no display codes)
  if (/\bgud27\b|\bgud24\b/.test(base) || base.includes('unitized') || base.includes('laundry center')) {
    extras.push('timer dryer', 'mechanical timer', 'no error codes');
  }
  if (
    base.includes('timer not advancing')
    || base.includes('timer stuck')
    || base.includes('timer wont advance')
    || base.includes("timer won't advance")
    || base.includes('stuck on')
  ) {
    extras.push('timer not advancing', 'cycling thermostat', 'outlet thermostat', 'vent restriction');
  }

  return extras.length ? `${base} ${extras.join(' ')}` : base;
}

function hasStructuredErrorCode(text: string): boolean {
  const blob = expandErrorCodeTokens(text);
  if (/\bf\d+e\d+\b/.test(blob)) return true;
  if (/\b(tc5?|9c1|hc|he|fc|bc2|dc|df|ac)\b/.test(blob)) return true;
  if (/\b\d{1,2}[ec]\b/.test(blob) || /\b\d{2}er\b/.test(blob)) return true;
  if (/\b(pcer|ofof|o ff)\b/.test(blob)) return true;
  return /\b[fr]\s*d[hs]\b/.test(blob) || /\b(e\s*)?[fr]{2}\b/.test(blob) || /\b(e\s*)?[cior][fcdhos]?\b/.test(blob);
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
