import { evaluateDiagnosticIntelligence } from '../intelligence/diagnosticIntelligenceEngine';
import type { RoutingEvaluationResult } from '../routing/types';
import {
  getNextDiagnosticActions,
  hydrateDiagnosticSession,
  resolveUnifiedOemLeadRecommendation,
} from '../session';
import type { LooseDiagnosticPayload } from '../session/types';
import { recommendServiceProcedures } from './recommendServiceProcedures';
import {
  procedureRunRequiresRepairAction,
  resolveWizardStepAfterProcedureComplete,
} from './procedureWizardRouting';
import { shouldInsertOemWizardStep } from './procedureWizardLead';
import type { MeasurementContext } from '../knowledge/measurementContext';
import type { WizardDefinition } from '../types';
import type { ProcedureRunState } from './types';

export type ProcedureContinuationPlan =
  | { type: 'repair_action' }
  | { type: 'next_oem'; procedureId: string }
  | { type: 'next_wizard_step'; wizardStepKey: string }
  | { type: 'mechanical' };

export type PlanContinuationAfterProcedureCompleteInput = {
  completedProcedureId: string;
  completedRunState: ProcedureRunState;
  payload: LooseDiagnosticPayload;
  workOrder?: Record<string, unknown> | null;
  routingResult: RoutingEvaluationResult | null;
  wizardDefinition: WizardDefinition | null | undefined;
  defaultStepOrder: string[];
  measurementContext: MeasurementContext;
  complaintChipIds: string[];
  errorCodes: string[];
  visitedStepKeys: string[];
  options?: {
    readOnly?: boolean;
    skippedOemWizardStep?: boolean;
    /** Matches showProcedureRunner — platform + catalog + complaint context. */
    oemRunnerEnabled?: boolean;
  };
};

export type ProcedureContinuationHandlers = {
  jumpToStepKey: (stepKey: string) => void;
  startOemProcedure: (procedureId: string) => void;
};

export function executeProcedureContinuationPlan(
  plan: ProcedureContinuationPlan,
  handlers: ProcedureContinuationHandlers,
): void {
  if (plan.type === 'repair_action') {
    return;
  }
  if (plan.type === 'next_oem') {
    handlers.jumpToStepKey('oem_test');
    handlers.startOemProcedure(plan.procedureId);
    return;
  }
  if (plan.type === 'next_wizard_step') {
    handlers.jumpToStepKey(plan.wizardStepKey);
    return;
  }
  handlers.jumpToStepKey('mechanical');
}

function resolveMechanicalPlan(
  completedProcedureId: string,
  completedRunState: ProcedureRunState,
): ProcedureContinuationPlan {
  const wizardStepKey = resolveWizardStepAfterProcedureComplete(
    completedProcedureId,
    completedRunState,
  );
  if (wizardStepKey && wizardStepKey !== 'mechanical') {
    return { type: 'next_wizard_step', wizardStepKey };
  }
  return { type: 'mechanical' };
}

export function planContinuationAfterProcedureComplete(
  input: PlanContinuationAfterProcedureCompleteInput,
): ProcedureContinuationPlan {
  const {
    completedProcedureId,
    completedRunState,
    payload,
    workOrder,
    routingResult,
    wizardDefinition,
    defaultStepOrder,
    measurementContext,
    complaintChipIds,
    errorCodes,
    visitedStepKeys,
    options = {},
  } = input;

  if (procedureRunRequiresRepairAction(completedProcedureId, completedRunState)) {
    return { type: 'repair_action' };
  }

  const readOnly = Boolean(options.readOnly);
  const skippedOemWizardStep = Boolean(options.skippedOemWizardStep);
  const oemRunnerEnabled = Boolean(options.oemRunnerEnabled);

  const procedureRuns = payload.procedureRuns || {};
  const intelligence = evaluateDiagnosticIntelligence(
    payload.templateId,
    payload.fields || {},
    undefined,
    {
      visitedStepKeys,
      defaultStepOrder,
      procedureRuns,
    },
  );

  const session = hydrateDiagnosticSession({
    payload: {
      ...payload,
      visitedStepKeys,
      currentStepKey: payload.currentStepKey || visitedStepKeys.at(-1) || null,
      procedureRuns,
    },
    workOrder,
    derived: { intelligence },
  });

  const procedureContext = {
    templateId: payload.templateId,
    measurementContext,
    intelligence,
    complaintChipIds,
    errorCodes,
    procedureRuns,
  };

  const actions = getNextDiagnosticActions({
    session,
    wizardContext: {
      intelligence,
      routing: routingResult,
      wizardDefinition,
      defaultStepOrder,
      reviewStepId: wizardDefinition?.reviewStep?.id || 'diagnostic_review',
    },
    procedureContext,
  });

  const procedureRecommendations = recommendServiceProcedures(procedureContext);
  const topRecommendation = resolveUnifiedOemLeadRecommendation(
    procedureRecommendations,
    actions.candidates.find((c) => c.type === 'service_procedure' && c.procedureId)?.procedureId
      ?? null,
  );
  const insertOemWizardStep = shouldInsertOemWizardStep(
    complaintChipIds,
    topRecommendation,
    { skippedOemWizardStep, errorCodes },
  );
  const oemForegroundAllowed =
    !readOnly
    && !skippedOemWizardStep
    && oemRunnerEnabled
    && insertOemWizardStep;

  const top = actions.candidates[0];
  if (!top) {
    return resolveMechanicalPlan(completedProcedureId, completedRunState);
  }

  if (
    top.type === 'service_procedure'
    && top.procedureId
    && top.procedureId !== completedProcedureId
    && oemForegroundAllowed
  ) {
    return { type: 'next_oem', procedureId: top.procedureId };
  }

  if (top.type === 'wizard_step' && top.wizardStepKey) {
    return { type: 'next_wizard_step', wizardStepKey: top.wizardStepKey };
  }

  const nextWizard = actions.candidates.find(
    (candidate) => candidate.type === 'wizard_step' && candidate.wizardStepKey,
  );
  if (nextWizard?.wizardStepKey) {
    return { type: 'next_wizard_step', wizardStepKey: nextWizard.wizardStepKey };
  }

  const nextOtherOem = actions.candidates.find(
    (candidate) =>
      candidate.type === 'service_procedure'
      && candidate.procedureId
      && candidate.procedureId !== completedProcedureId,
  );
  if (nextOtherOem?.procedureId && oemForegroundAllowed) {
    return { type: 'next_oem', procedureId: nextOtherOem.procedureId };
  }

  return resolveMechanicalPlan(completedProcedureId, completedRunState);
}
