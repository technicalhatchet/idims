import {
  parseDiagnosticNotePayload,
  serializeDiagnosticNotePayload,
} from '../../../../../../constants/diagnosticTemplates.js';
import {
  getComponentVerificationLevel,
  isVerifiedFailedState,
} from '../../../../intelligence/componentVerification';
import { evaluateDiagnosticIntelligence } from '../../../../intelligence/diagnosticIntelligenceEngine';
import type { DiagnosticIntelligenceResult } from '../../../../intelligence/evidenceTypes';
import { buildMeasurementContext } from '../../../../knowledge/platformRegistry';
import { getWizardDefinition } from '../../../../registry/wizardRegistry';
import {
  clearHarnessServiceProcedures,
  registerHarnessServiceProcedure,
} from '../../../../procedures/procedureRegistry';
import { submitProcedureStep, createProcedureRun } from '../../../../procedures/procedureRunner';
import type { ProcedureRunState, ServiceProcedure } from '../../../../procedures/types';
import {
  getNextDiagnosticActions,
  hydrateDiagnosticSession,
  replanDiagnosticActions,
  serializeDiagnosticSession,
} from '../../../index';
import type { GetNextDiagnosticActionsResult } from '../../../getNextDiagnosticActions';
import type { NextTestCandidate } from '../../../candidates/types';
import type { LooseDiagnosticPayload } from '../../../types';

export const HARNESS_PROCEDURE_ID = 'fl-washer-scenario-harness';
export const MEASUREMENT_HARNESS_ID = 'fl-washer-measurement-harness';

export const MEASUREMENT_CONTEXT = buildMeasurementContext({
  templateId: 'washer',
  equipmentMake: 'Whirlpool',
  equipmentModel: 'WFW8300',
});

export const WONT_SPIN_FIELDS = {
  'customer_complaint.complaint_tags': ['wont_spin'],
};

export const VISITED_STEP_KEYS = ['complaint', 'visual', 'functional'];

export const MOTOR_MEASUREMENT_HARNESS: ServiceProcedure = {
  id: MEASUREMENT_HARNESS_ID,
  version: '1.0.0',
  title: 'FL washer motor load voltage harness',
  platformId: 'whirlpool_duet_sport',
  componentIds: ['drive_motor'],
  source: {
    manualId: 'HARNESS',
    manualTitle: 'Harness',
    oemTestNumber: 'M1',
    oemTestTitle: 'Motor load voltage',
    pages: [1],
  },
  entryStepId: 'motor_voltage_step',
  steps: [
    {
      id: 'motor_voltage_step',
      order: 1,
      type: 'measurement',
      title: 'Motor load voltage',
      measurementKnowledgeId: 'flWasherHarnessMotorLoadVoltage120',
      requiresInput: true,
      branches: [
        {
          id: 'motor_voltage_abnormal',
          label: 'Abnormal output',
          when: { kind: 'measurement_critical' },
          nextStepId: 'outcome_investigate',
        },
        {
          id: 'motor_voltage_normal',
          label: 'Within range',
          when: { kind: 'measurement_normal' },
          nextStepId: 'outcome_ok',
        },
      ],
    },
    {
      id: 'outcome_ok',
      order: 2,
      type: 'outcome',
      title: 'Output verified',
      oemOutcome: 'Motor load voltage within spec.',
    },
    {
      id: 'outcome_investigate',
      order: 3,
      type: 'outcome',
      title: 'Investigate output path',
      oemOutcome: 'Abnormal motor output — trace wiring, switching, and load before condemning control.',
    },
  ],
};

export type HarnessBranchRef = {
  procedureId?: string;
  stepId: string;
  branchId: string;
  effects?: ProcedureRunState['appliedDiagnosticEffects'];
};

export function candidateKey(candidate: NextTestCandidate): string {
  return candidate.procedureId || candidate.wizardStepKey || candidate.id;
}

export function rankOf(candidates: NextTestCandidate[], key: string): number {
  return candidates.findIndex((item) => candidateKey(item) === key);
}

export function scoreOf(candidates: NextTestCandidate[], key: string): number {
  return candidates.find((item) => candidateKey(item) === key)?.score ?? -1;
}

export function breakdownOf(candidates: NextTestCandidate[], key: string) {
  return candidates.find((item) => candidateKey(item) === key)?.scoreBreakdown;
}

export function withHarnessBranches(
  entries: HarnessBranchRef[],
): Record<string, ProcedureRunState> {
  const runs: Record<string, ProcedureRunState> = {};

  for (const entry of entries) {
    const procedureId = entry.procedureId || HARNESS_PROCEDURE_ID;
    const existing = runs[procedureId];
    const resolvedEvent = {
      stepId: entry.stepId,
      branchId: entry.branchId,
      at: '2026-03-12T10:05:00.000Z',
    };

    if (!existing) {
      runs[procedureId] = {
        procedureId,
        version: '1.0.0',
        startedAt: '2026-03-12T10:00:00.000Z',
        currentStepId: entry.stepId,
        completedStepIds: [entry.stepId],
        stepInputs: {},
        status: 'completed',
        resolvedBranchEvents: [resolvedEvent],
        appliedDiagnosticEffects: entry.effects || [],
      };
      continue;
    }

    runs[procedureId] = {
      ...existing,
      completedStepIds: [...new Set([...existing.completedStepIds, entry.stepId])],
      resolvedBranchEvents: [...(existing.resolvedBranchEvents || []), resolvedEvent],
      appliedDiagnosticEffects: [
        ...(existing.appliedDiagnosticEffects || []),
        ...(entry.effects || []),
      ],
    };
  }

  return runs;
}

export function mergeProcedureRuns(
  ...runMaps: Array<Record<string, ProcedureRunState>>
): Record<string, ProcedureRunState> {
  const merged: Record<string, ProcedureRunState> = {};

  for (const runs of runMaps) {
    for (const [procedureId, run] of Object.entries(runs)) {
      const existing = merged[procedureId];
      if (!existing) {
        merged[procedureId] = run;
        continue;
      }

      merged[procedureId] = {
        ...existing,
        ...run,
        completedStepIds: [...new Set([...existing.completedStepIds, ...run.completedStepIds])],
        stepInputs: { ...existing.stepInputs, ...run.stepInputs },
        stepEvaluations: {
          ...(existing.stepEvaluations || {}),
          ...(run.stepEvaluations || {}),
        },
        resolvedBranchEvents: [
          ...(existing.resolvedBranchEvents || []),
          ...(run.resolvedBranchEvents || []),
        ],
        appliedDiagnosticEffects: [
          ...(existing.appliedDiagnosticEffects || []),
          ...(run.appliedDiagnosticEffects || []),
        ],
      };
    }
  }

  return merged;
}

export function buildMotorVoltageMeasurementRun(
  rawValue: string,
): Record<string, ProcedureRunState> {
  registerHarnessServiceProcedure(MOTOR_MEASUREMENT_HARNESS);
  const run = createProcedureRun(MOTOR_MEASUREMENT_HARNESS);
  const result = submitProcedureStep(MOTOR_MEASUREMENT_HARNESS, run, {
    kind: 'measurement',
    value: rawValue,
    context: { motorRequested: true, doorLocked: true },
  });
  return { [MEASUREMENT_HARNESS_ID]: result.runState };
}

export function buildCompletedDoorLockRun(): Record<string, ProcedureRunState> {
  return {
    'w8178558-door-lock': {
      procedureId: 'w8178558-door-lock',
      version: '1.0.0',
      startedAt: '2026-03-12T10:00:00.000Z',
      currentStepId: 'door_lock_path_verified',
      completedStepIds: [
        'safety_power_off',
        'live_test_door_lock',
        'door_lock_path_verified',
      ],
      stepInputs: {
        live_test_door_lock: { kind: 'checkpoint', value: 'yes' },
      },
      status: 'completed',
      resolvedBranchEvents: [{
        stepId: 'live_test_door_lock',
        branchId: 'lock_energizes_yes',
        at: '2026-03-12T10:05:00.000Z',
      }],
      appliedDiagnosticEffects: [{
        stepId: 'live_test_door_lock',
        branchId: 'lock_energizes_yes',
        at: '2026-03-12T10:05:00.000Z',
        effects: [
          { type: 'eliminate', componentId: 'door_lock', evidenceId: 'eliminate_door_lock_open_door_lock_ok' },
          { type: 'eliminate', componentId: 'control_board', evidenceId: 'eliminate_control_board_ccu_door_lock_ok' },
        ],
      }],
    },
  };
}

export type ScenarioSnapshot = {
  label: string;
  evidence: string;
  result: GetNextDiagnosticActionsResult;
  intelligence: DiagnosticIntelligenceResult | null;
};

export function evaluateScenario(
  procedureRuns: Record<string, ProcedureRunState> = {},
): ScenarioSnapshot {
  const wizardDefinition = getWizardDefinition('washer');
  const defaultStepOrder = wizardDefinition?.defaultSteps.map(
    (step) => step.stepKey || step.sectionId,
  ) || [];
  const intelligence = evaluateDiagnosticIntelligence(
    'washer',
    WONT_SPIN_FIELDS,
    undefined,
    {
      visitedStepKeys: VISITED_STEP_KEYS,
      defaultStepOrder,
      procedureRuns,
    },
  );
  const session = hydrateDiagnosticSession({
    payload: {
      templateId: 'washer',
      fields: WONT_SPIN_FIELDS,
      visitedStepKeys: VISITED_STEP_KEYS,
      currentStepKey: 'functional',
      procedureRuns,
      activeProcedureId: null,
      timeline: [],
      evidenceSnapshot: null,
    },
    workOrder: { equipment_make: 'Whirlpool', equipment_model: 'WFW8300' },
    derived: { intelligence },
  });

  const result = getNextDiagnosticActions({
    session,
    wizardContext: { intelligence, wizardDefinition, defaultStepOrder },
    procedureContext: {
      templateId: 'washer',
      measurementContext: MEASUREMENT_CONTEXT,
      intelligence,
      complaintChipIds: ['wont_spin'],
      errorCodes: [],
      procedureRuns,
    },
    limit: 12,
  });

  return {
    label: '',
    evidence: '',
    result,
    intelligence,
  };
}

export function findComponentState(
  intelligence: DiagnosticIntelligenceResult | null,
  componentId: string,
) {
  if (!intelligence) return null;
  for (const components of Object.values(intelligence.componentsByCategory || {})) {
    const match = components.find((item) => item.id === componentId);
    if (match) return match;
  }
  return null;
}

export function auditNoPrematureVerifiedFailed(
  intelligence: DiagnosticIntelligenceResult | null,
  stageLabel: string,
): void {
  if (!intelligence) return;
  for (const components of Object.values(intelligence.componentsByCategory || {})) {
    for (const component of components) {
      if (isVerifiedFailedState(component.state)) {
        throw new Error(
          `Stage "${stageLabel}": premature verified_failed on ${component.id} (${component.state})`,
        );
      }
    }
  }
}

export function assertRankingFlip(
  before: NextTestCandidate[],
  after: NextTestCandidate[],
  initiallyHigher: string,
  initiallyLower: string,
  message: string,
): void {
  const beforeHigh = rankOf(before, initiallyHigher);
  const beforeLow = rankOf(before, initiallyLower);
  const afterHigh = rankOf(after, initiallyHigher);
  const afterLow = rankOf(after, initiallyLower);

  if (beforeHigh < 0 || beforeLow < 0 || afterHigh < 0 || afterLow < 0) {
    throw new Error(`${message}: missing candidate in pool`);
  }

  if (beforeHigh >= beforeLow) {
    throw new Error(`${message}: expected ${initiallyHigher} above ${initiallyLower} initially`);
  }
  if (afterLow >= afterHigh) {
    throw new Error(`${message}: expected ${initiallyLower} above ${initiallyHigher} after stage`);
  }
}

export function topCandidateLabels(result: GetNextDiagnosticActionsResult, count = 3): string[] {
  return result.candidates.slice(0, count).map((candidate) => {
    const key = candidateKey(candidate);
    const breakdown = candidate.scoreBreakdown;
    const tags = [
      breakdown.branchBoost ? `b${breakdown.branchBoost.toFixed(2)}` : null,
      breakdown.measurementBoost ? `m${breakdown.measurementBoost.toFixed(2)}` : null,
      breakdown.routingFit ? `r${breakdown.routingFit.toFixed(2)}` : null,
      breakdown.deprioritizationPenalty ? `p${breakdown.deprioritizationPenalty.toFixed(2)}` : null,
      breakdown.existingSystemBoost ? `e${breakdown.existingSystemBoost.toFixed(2)}` : null,
    ].filter(Boolean).join(',');
    return tags ? `${key} (${tags})` : key;
  });
}

export function printEvolutionTable(rows: Array<{
  stage: string;
  top: string[];
  evidence: string;
}>): void {
  console.log('\n--- DS-7 Candidate Evolution ---');
  console.log('Stage\t#1\t#2\t#3\tKey evidence');
  for (const row of rows) {
    const [one, two, three] = row.top;
    console.log(`${row.stage}\t${one || '—'}\t${two || '—'}\t${three || '—'}\t${row.evidence}`);
  }
  console.log('--- end evolution table ---\n');
}

export function serializeAndRehydrateScenario(
  procedureRuns: Record<string, ProcedureRunState>,
): GetNextDiagnosticActionsResult {
  const beforeSnapshot = evaluateScenario(procedureRuns);
  const session = hydrateDiagnosticSession({
    payload: {
      templateId: 'washer',
      fields: WONT_SPIN_FIELDS,
      visitedStepKeys: VISITED_STEP_KEYS,
      currentStepKey: 'functional',
      procedureRuns,
      activeProcedureId: null,
      timeline: [],
      evidenceSnapshot: null,
    },
    workOrder: { equipment_make: 'Whirlpool', equipment_model: 'WFW8300' },
    derived: { intelligence: beforeSnapshot.intelligence },
    sessionId: 'ds7-torture-replay',
  });
  const serialized = serializeDiagnosticNotePayload(
    serializeDiagnosticSession(session, session.payload as LooseDiagnosticPayload),
  );
  const parsed = parseDiagnosticNotePayload(serialized) as {
    procedureRuns?: Record<string, ProcedureRunState>;
    visitedStepKeys?: string[];
  };

  const wizardDefinition = getWizardDefinition('washer');
  const defaultStepOrder = wizardDefinition?.defaultSteps.map(
    (step) => step.stepKey || step.sectionId,
  ) || [];
  const intelligence = evaluateDiagnosticIntelligence(
    'washer',
    WONT_SPIN_FIELDS,
    undefined,
    {
      visitedStepKeys: parsed.visitedStepKeys || VISITED_STEP_KEYS,
      defaultStepOrder,
      procedureRuns: parsed.procedureRuns || {},
    },
  );
  const rehydratedSession = hydrateDiagnosticSession({
    payload: {
      templateId: 'washer',
      fields: WONT_SPIN_FIELDS,
      visitedStepKeys: parsed.visitedStepKeys || VISITED_STEP_KEYS,
      currentStepKey: 'functional',
      procedureRuns: parsed.procedureRuns || {},
      activeProcedureId: null,
      timeline: [],
      evidenceSnapshot: null,
    },
    derived: { intelligence },
  });

  return replanDiagnosticActions({
    session: rehydratedSession,
    wizardContext: { intelligence, wizardDefinition, defaultStepOrder },
    procedureContext: {
      templateId: 'washer',
      measurementContext: MEASUREMENT_CONTEXT,
      intelligence,
      complaintChipIds: ['wont_spin'],
      errorCodes: [],
      procedureRuns: parsed.procedureRuns || {},
    },
    limit: 12,
  });
}

export function setupHarnessProcedures(): void {
  registerHarnessServiceProcedure(MOTOR_MEASUREMENT_HARNESS);
}

export function teardownHarnessProcedures(): void {
  clearHarnessServiceProcedures();
}

export function summarizeComponentStates(
  intelligence: DiagnosticIntelligenceResult | null,
): string {
  if (!intelligence) return 'no intelligence';
  const parts: string[] = [];
  for (const components of Object.values(intelligence.componentsByCategory || {})) {
    for (const component of components) {
      if (component.state === 'unknown' && component.evidence <= 0) continue;
      parts.push(
        `${component.id}=${getComponentVerificationLevel(component.state)}`,
      );
    }
  }
  return parts.length ? parts.join('; ') : 'all unknown';
}
