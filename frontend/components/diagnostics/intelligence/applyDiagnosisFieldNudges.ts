import type { ComponentEvidenceState } from './evidenceTypes';
import type { EvidenceConfig, EvidenceLedgerEntry } from './evidenceTypes';

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeText(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

interface DiagnosisPattern {
  id: string;
  pattern: RegExp;
  target: string;
  targetLayer: 'category' | 'component';
  value: number;
  explanation: string;
}

const COOLING_AIRFLOW_PATTERNS: DiagnosisPattern[] = [
  {
    id: 'diag_condenser_fan',
    pattern: /\bcondenser\s*fan\b|\bcondenser\s*motor\b/,
    target: 'condenser_fan',
    targetLayer: 'component',
    value: 10,
    explanation: 'Diagnosis mentions condenser fan — technician-stated lead.',
  },
  {
    id: 'diag_condenser_coil',
    pattern: /\bcondenser\s*coil\b|\bdirty\s*coil\b|\bcondenser\b/,
    target: 'airflow',
    targetLayer: 'category',
    value: 8,
    explanation: 'Diagnosis mentions condenser / coil — airflow path noted.',
  },
  {
    id: 'diag_evap_fan',
    pattern: /\bevap(?:orator)?\s*fan\b/,
    target: 'evap_fan',
    targetLayer: 'component',
    value: 10,
    explanation: 'Diagnosis mentions evaporator fan — technician-stated lead.',
  },
  {
    id: 'diag_defrost',
    pattern: /\bdefrost\b|\bheater\b|\bbi-?metal\b|\bterminator\b/,
    target: 'defrost_system',
    targetLayer: 'category',
    value: 8,
    explanation: 'Diagnosis mentions defrost circuit — technician-stated lead.',
  },
  {
    id: 'diag_sealed',
    pattern: /\bcompressor\b|\bsealed\s*system\b|\brefrigerant\b|\bleak\b/,
    target: 'sealed_system',
    targetLayer: 'category',
    value: 8,
    explanation: 'Diagnosis mentions sealed system — technician-stated lead.',
  },
];

const PATTERNS_BY_TEMPLATE: Record<string, DiagnosisPattern[]> = {
  refrigerator: COOLING_AIRFLOW_PATTERNS,
  standalone_freezer: COOLING_AIRFLOW_PATTERNS,
  washer: [
    {
      id: 'diag_drain_pump',
      pattern: /\bdrain\s*pump\b|\bpump\s*assembly\b/,
      target: 'drain_pump',
      targetLayer: 'component',
      value: 10,
      explanation: 'Diagnosis mentions drain pump — technician-stated lead.',
    },
    {
      id: 'diag_drain_pump_cat',
      pattern: /\bdrain\s*pump\b/,
      target: 'drain_pump',
      targetLayer: 'category',
      value: 8,
      explanation: 'Diagnosis mentions drain pump — drain path noted.',
    },
    {
      id: 'diag_bearing_suspension',
      pattern: /\bbearing\b|\bsuspension\b|\bshock\b|\btub\s*seal\b/,
      target: 'drive_motor',
      targetLayer: 'category',
      value: 10,
      explanation: 'Diagnosis mentions bearing or suspension — drive path noted.',
    },
    {
      id: 'diag_belt',
      pattern: /\bbelt\b|\bpulley\b|\btransmission\b/,
      target: 'drive_motor',
      targetLayer: 'category',
      value: 8,
      explanation: 'Diagnosis mentions belt or transmission — drive path noted.',
    },
    {
      id: 'diag_drive_motor',
      pattern: /\bdrive\s*motor\b|\bwash\s*motor\b|\bmotor\b/,
      target: 'drive_motor',
      targetLayer: 'component',
      value: 8,
      explanation: 'Diagnosis mentions drive motor — technician-stated lead.',
    },
    {
      id: 'diag_inlet_valve',
      pattern: /\binlet\s*valve\b|\bwater\s*valve\b/,
      target: 'inlet_valve',
      targetLayer: 'component',
      value: 8,
      explanation: 'Diagnosis mentions inlet valve — fill path noted.',
    },
  ],
  dishwasher: [
    {
      id: 'diag_drain_pump',
      pattern: /\bdrain\s*pump\b/,
      target: 'drain_pump',
      targetLayer: 'component',
      value: 10,
      explanation: 'Diagnosis mentions drain pump — technician-stated lead.',
    },
    {
      id: 'diag_circulation',
      pattern: /\bcirculation\s*pump\b|\bwash\s*motor\b|\bcirculation\b/,
      target: 'circulation_pump',
      targetLayer: 'component',
      value: 10,
      explanation: 'Diagnosis mentions circulation / wash motor — technician-stated lead.',
    },
    {
      id: 'diag_wash_circuit',
      pattern: /\bspray\s*arm\b|\bchopper\b|\bsump\b|\bwash\s*circuit\b/,
      target: 'wash_circuit',
      targetLayer: 'category',
      value: 8,
      explanation: 'Diagnosis mentions wash / spray path — circulation noted.',
    },
    {
      id: 'diag_heater',
      pattern: /\bheater\b|\belement\b|\bdry\s*fan\b/,
      target: 'heater',
      targetLayer: 'component',
      value: 8,
      explanation: 'Diagnosis mentions heater — heat/dry path noted.',
    },
    {
      id: 'diag_inlet_valve',
      pattern: /\binlet\s*valve\b|\bwater\s*valve\b/,
      target: 'inlet_valve',
      targetLayer: 'component',
      value: 8,
      explanation: 'Diagnosis mentions inlet valve — fill path noted.',
    },
  ],
};

/**
 * Light intelligence nudge from diagnosis free-text — does not confirm components.
 */
export function applyDiagnosisFieldNudges(
  config: EvidenceConfig,
  categoryScores: Map<string, number>,
  componentScores: Map<string, { evidence: number; state: ComponentEvidenceState }>,
  ledger: EvidenceLedgerEntry[],
  fields: Record<string, unknown>,
): number {
  const patterns = PATTERNS_BY_TEMPLATE[config.templateId];
  if (!patterns?.length) return 0;

  const diagnosisText = [
    fields['diagnosis.root_cause'],
    fields['diagnosis.recommended_repair'],
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(' ');

  if (!diagnosisText) return 0;

  const appliedPatternIds = new Set<string>();
  let nudgeCount = 0;

  for (const pattern of patterns) {
    if (appliedPatternIds.has(pattern.id)) continue;
    if (!pattern.pattern.test(diagnosisText)) continue;

    appliedPatternIds.add(pattern.id);
    nudgeCount += 1;

    if (pattern.targetLayer === 'category') {
      categoryScores.set(
        pattern.target,
        clampScore((categoryScores.get(pattern.target) || 0) + pattern.value),
      );
    } else {
      const current = componentScores.get(pattern.target) ?? { evidence: 0, state: 'unknown' as ComponentEvidenceState };
      componentScores.set(pattern.target, {
        ...current,
        evidence: clampScore(current.evidence + pattern.value),
      });
    }

    ledger.push({
      ruleId: pattern.id,
      target: pattern.target,
      targetLayer: pattern.targetLayer,
      delta: pattern.value,
      explanation: pattern.explanation,
      effect: 'increase',
      trigger: { type: 'field', label: 'Diagnosis notes' },
    });
  }

  return nudgeCount;
}
