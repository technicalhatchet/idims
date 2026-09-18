import {
  parseDiagnosticNotePayload,
  serializeDiagnosticNotePayload,
} from '../../../../../../constants/diagnosticTemplates.js';
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
import type { LooseDiagnosticPayload } from '../../../types';
import {
  auditNoPrematureVerifiedFailed,
  breakdownOf,
  candidateKey,
  findComponentState,
  mergeProcedureRuns,
  printEvolutionTable,
  rankOf,
  scoreOf,
  topCandidateLabels,
  type HarnessBranchRef,
  withHarnessBranches as withFlHarnessBranches,
} from '../fl-washer/scenarioKit';

export const TL_HARNESS_PROCEDURE_ID = 'tl-washer-scenario-harness';
export const TL_MEASUREMENT_HARNESS_ID = 'tl-washer-motor-ohms-harness';

export const TL_MEASUREMENT_CONTEXT = buildMeasurementContext({
  templateId: 'washer',
  equipmentMake: 'Whirlpool',
  equipmentModel: 'WTW9500',
});

export const WONT_SPIN_FIELDS = {
  'customer_complaint.complaint_tags': ['wont_spin'],
};

export const VISITED_STEP_KEYS = ['complaint', 'visual', 'functional'];

export const TL_MOTOR_OHMS_HARNESS: ServiceProcedure = {
  id: TL_MEASUREMENT_HARNESS_ID,
  version: '1.0.0',
  title: 'TL washer BPM motor ohms harness',
  platformId: 'whirlpool_tl_dd',
  componentIds: ['drive_motor'],
  source: {
    manualId: 'HARNESS',
    manualTitle: 'Harness',
    oemTestNumber: '3b',
    oemTestTitle: 'Drive motor ohms',
    pages: [1],
  },
  entryStepId: 'motor_ohms_step',
  steps: [
    {
      id: 'motor_ohms_step',
      order: 1,
      type: 'measurement',
      title: 'BPM motor winding ohms',
      measurementKnowledgeId: 'whirlpoolTlDdWasherMotorOhms',
      requiresInput: true,
      branches: [
        {
          id: 'motor_open',
          label: 'Open / out of range',
          when: { kind: 'measurement_critical' },
          nextStepId: 'outcome_investigate',
        },
        {
          id: 'motor_ok',
          label: 'Within spec',
          when: { kind: 'measurement_normal' },
          nextStepId: 'outcome_ok',
        },
      ],
    },
    {
      id: 'outcome_ok',
      order: 2,
      type: 'outcome',
      title: 'Motor ohms verified',
      oemOutcome: 'Motor winding within BPM spec.',
    },
    {
      id: 'outcome_investigate',
      order: 3,
      type: 'outcome',
      title: 'Investigate motor circuit',
      oemOutcome: 'Abnormal BPM motor ohms — verify harness and shifter path before condemning control.',
    },
  ],
};

export function withTlHarnessBranches(
  entries: HarnessBranchRef[],
): Record<string, ProcedureRunState> {
  return withFlHarnessBranches(
    entries.map((entry) => ({
      ...entry,
      procedureId: entry.procedureId || TL_HARNESS_PROCEDURE_ID,
    })),
  );
}

export function buildTlMotorOhmsMeasurementRun(
  rawValue: string,
): Record<string, ProcedureRunState> {
  registerHarnessServiceProcedure(TL_MOTOR_OHMS_HARNESS);
  const run = createProcedureRun(TL_MOTOR_OHMS_HARNESS);
  const result = submitProcedureStep(TL_MOTOR_OHMS_HARNESS, run, {
    kind: 'measurement',
    value: rawValue,
    context: { motorRequested: true, lidLocked: true },
  });
  return { [TL_MEASUREMENT_HARNESS_ID]: result.runState };
}

export function evaluateTlScenario(
  procedureRuns: Record<string, ProcedureRunState> = {},
): {
  result: GetNextDiagnosticActionsResult;
  intelligence: DiagnosticIntelligenceResult | null;
} {
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
    workOrder: { equipment_make: 'Whirlpool', equipment_model: 'WTW9500' },
    derived: { intelligence },
  });

  const result = getNextDiagnosticActions({
    session,
    wizardContext: { intelligence, wizardDefinition, defaultStepOrder },
    procedureContext: {
      templateId: 'washer',
      measurementContext: TL_MEASUREMENT_CONTEXT,
      intelligence,
      complaintChipIds: ['wont_spin'],
      errorCodes: [],
      procedureRuns,
    },
    limit: 12,
  });

  return { result, intelligence };
}

export function serializeAndRehydrateTlScenario(
  procedureRuns: Record<string, ProcedureRunState>,
): GetNextDiagnosticActionsResult {
  const beforeSnapshot = evaluateTlScenario(procedureRuns);
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
    workOrder: { equipment_make: 'Whirlpool', equipment_model: 'WTW9500' },
    derived: { intelligence: beforeSnapshot.intelligence },
    sessionId: 'ds7-tl-torture-replay',
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
    workOrder: { equipment_make: 'Whirlpool', equipment_model: 'WTW9500' },
    derived: { intelligence },
  });

  return replanDiagnosticActions({
    session: rehydratedSession,
    wizardContext: { intelligence, wizardDefinition, defaultStepOrder },
    procedureContext: {
      templateId: 'washer',
      measurementContext: TL_MEASUREMENT_CONTEXT,
      intelligence,
      complaintChipIds: ['wont_spin'],
      errorCodes: [],
      procedureRuns: parsed.procedureRuns || {},
    },
    limit: 12,
  });
}

export function setupTlHarnessProcedures(): void {
  registerHarnessServiceProcedure(TL_MOTOR_OHMS_HARNESS);
}

export function teardownTlHarnessProcedures(): void {
  clearHarnessServiceProcedures();
}

export {
  auditNoPrematureVerifiedFailed,
  breakdownOf,
  candidateKey,
  findComponentState,
  mergeProcedureRuns,
  printEvolutionTable,
  rankOf,
  scoreOf,
  topCandidateLabels,
};
