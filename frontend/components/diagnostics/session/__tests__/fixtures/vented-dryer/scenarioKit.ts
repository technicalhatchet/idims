import { evaluateDiagnosticIntelligence } from '../../../../intelligence/diagnosticIntelligenceEngine';
import type { DiagnosticIntelligenceResult } from '../../../../intelligence/evidenceTypes';
import { buildMeasurementContext } from '../../../../knowledge/platformRegistry';
import { getWizardDefinition } from '../../../../registry/wizardRegistry';
import {
  clearHarnessServiceProcedures,
  registerHarnessServiceProcedure,
} from '../../../../procedures/procedureRegistry';
import { createProcedureRun, submitProcedureStep } from '../../../../procedures/procedureRunner';
import type { ProcedureRunState, ServiceProcedure } from '../../../../procedures/types';
import {
  getNextDiagnosticActions,
  hydrateDiagnosticSession,
} from '../../../index';
import type { GetNextDiagnosticActionsResult } from '../../../getNextDiagnosticActions';
import {
  auditNoPrematureVerifiedFailed,
  candidateKey,
  findComponentState,
  printEvolutionTable,
  rankOf,
  scoreOf,
  topCandidateLabels,
  type HarnessBranchRef,
  withHarnessBranches,
} from '../fl-washer/scenarioKit';

export const DRYER_HARNESS_PROCEDURE_ID = 'vented-dryer-scenario-harness';
export const DRYER_HEATER_MEASUREMENT_HARNESS_ID = 'vented-dryer-heater-ohms-harness';

export const DRYER_MEASUREMENT_CONTEXT = buildMeasurementContext({
  templateId: 'electric_dryer',
  equipmentMake: 'Whirlpool',
  equipmentModel: 'WED8300',
});

export const NO_HEAT_FIELDS = {
  'customer_complaint.complaint_tags': ['no_heat'],
};

export const VISITED_STEP_KEYS = ['complaint', 'commonly_missed', 'visual', 'functional'];

export const DOOR_PROC = 'w8178559-door-switch';
export const MOTOR_PROC = 'w8178559-motor-circuit';
export const HEATER_PROC = 'w8178559-heater-electric';
export const THERMAL_FUSE_PROC = 'w8178559-thermal-fuse';
export const EXHAUST_NTC_PROC = 'w8178559-exhaust-thermistor';

export const DOOR_GOOD: HarnessBranchRef = {
  stepId: 'door_step',
  branchId: 'door_closed_authorized',
};
export const MOTOR_GOOD: HarnessBranchRef = { stepId: 'motor_step', branchId: 'motor_running' };
export const BLOWER_GOOD: HarnessBranchRef = { stepId: 'blower_step', branchId: 'blower_running' };
export const AIRFLOW_GOOD: HarnessBranchRef = {
  stepId: 'airflow_step',
  branchId: 'airflow_path_clear',
};
export const HEAT_COMMAND: HarnessBranchRef = {
  stepId: 'heat_command_step',
  branchId: 'heat_command_present',
};

export const DRYER_HEATER_OHMS_HARNESS: ServiceProcedure = {
  id: DRYER_HEATER_MEASUREMENT_HARNESS_ID,
  version: '1.0.0',
  title: 'Duet Sport dryer heater ohms harness',
  platformId: 'whirlpool_duet_sport_dryer',
  componentIds: ['heating_element'],
  source: {
    manualId: 'HARNESS',
    manualTitle: 'Harness',
    oemTestNumber: '3',
    oemTestTitle: 'Heater element ohms',
    pages: [1],
  },
  entryStepId: 'heater_ohms_step',
  steps: [
    {
      id: 'heater_ohms_step',
      order: 1,
      type: 'measurement',
      title: 'Heater element ohms',
      measurementKnowledgeId: 'whirlpoolDuetSportDryerHeaterOhms',
      requiresInput: true,
      branches: [
        {
          id: 'heater_open',
          label: 'Open / out of range',
          when: { kind: 'measurement_critical' },
          nextStepId: 'outcome_investigate',
        },
        {
          id: 'heater_ok',
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
      title: 'Heater ohms verified',
      oemOutcome: 'Element within 7–12 Ω spec.',
    },
    {
      id: 'outcome_investigate',
      order: 3,
      type: 'outcome',
      title: 'Investigate heat path',
      oemOutcome: 'Open heater or thermal protection — verify fuse, cutoff, and element.',
    },
  ],
};

export function withDryerHarnessBranches(
  entries: HarnessBranchRef[],
): Record<string, ProcedureRunState> {
  return withHarnessBranches(
    entries.map((entry) => ({
      ...entry,
      procedureId: entry.procedureId || DRYER_HARNESS_PROCEDURE_ID,
    })),
  );
}

export function buildDryerHeaterOhmsRun(
  rawValue: string,
): Record<string, ProcedureRunState> {
  registerHarnessServiceProcedure(DRYER_HEATER_OHMS_HARNESS);
  const run = createProcedureRun(DRYER_HEATER_OHMS_HARNESS);
  const result = submitProcedureStep(DRYER_HEATER_OHMS_HARNESS, run, {
    kind: 'measurement',
    value: rawValue,
    context: { heatRequested: true, doorClosed: true },
  });
  return { [DRYER_HEATER_MEASUREMENT_HARNESS_ID]: result.runState };
}

export function buildDryerSession(procedureRuns: Record<string, ProcedureRunState> = {}) {
  const wizardDefinition = getWizardDefinition('electric_dryer');
  const defaultStepOrder = wizardDefinition?.defaultSteps.map(
    (step) => step.stepKey || step.sectionId,
  ) || [];
  const intelligence = evaluateDiagnosticIntelligence(
    'electric_dryer',
    NO_HEAT_FIELDS,
    undefined,
    { visitedStepKeys: VISITED_STEP_KEYS, defaultStepOrder, procedureRuns },
  );
  return hydrateDiagnosticSession({
    payload: {
      templateId: 'electric_dryer',
      fields: NO_HEAT_FIELDS,
      visitedStepKeys: VISITED_STEP_KEYS,
      currentStepKey: 'functional',
      procedureRuns,
      activeProcedureId: null,
      timeline: [],
      evidenceSnapshot: null,
    },
    workOrder: { equipment_make: 'Whirlpool', equipment_model: 'WED8300' },
    derived: { intelligence },
  });
}

export function evaluateDryerScenario(
  procedureRuns: Record<string, ProcedureRunState> = {},
): {
  result: GetNextDiagnosticActionsResult;
  intelligence: DiagnosticIntelligenceResult | null;
} {
  const wizardDefinition = getWizardDefinition('electric_dryer');
  const defaultStepOrder = wizardDefinition?.defaultSteps.map(
    (step) => step.stepKey || step.sectionId,
  ) || [];
  const intelligence = evaluateDiagnosticIntelligence(
    'electric_dryer',
    NO_HEAT_FIELDS,
    undefined,
    { visitedStepKeys: VISITED_STEP_KEYS, defaultStepOrder, procedureRuns },
  );
  const session = hydrateDiagnosticSession({
    payload: {
      templateId: 'electric_dryer',
      fields: NO_HEAT_FIELDS,
      visitedStepKeys: VISITED_STEP_KEYS,
      currentStepKey: 'functional',
      procedureRuns,
      activeProcedureId: null,
      timeline: [],
      evidenceSnapshot: null,
    },
    workOrder: { equipment_make: 'Whirlpool', equipment_model: 'WED8300' },
    derived: { intelligence },
  });

  const result = getNextDiagnosticActions({
    session,
    wizardContext: { intelligence, wizardDefinition, defaultStepOrder },
    procedureContext: {
      templateId: 'electric_dryer',
      measurementContext: DRYER_MEASUREMENT_CONTEXT,
      intelligence,
      complaintChipIds: ['no_heat'],
      errorCodes: [],
      procedureRuns,
    },
    limit: 12,
  });

  return { result, intelligence };
}

export function setupDryerHarnessProcedures(): void {
  registerHarnessServiceProcedure(DRYER_HEATER_OHMS_HARNESS);
}

export function teardownDryerHarnessProcedures(): void {
  clearHarnessServiceProcedures();
}

export {
  auditNoPrematureVerifiedFailed,
  candidateKey,
  findComponentState,
  printEvolutionTable,
  rankOf,
  scoreOf,
  topCandidateLabels,
};
