import {
  collectExplicitFailureConfirms,
  isExplicitFailureEvidenceId,
} from '../intelligence/componentVerification';
import {
  resolveIntegratedPrimaryDiagnosticConclusion,
  runUsesIntegratedDiagnosticConclusions,
} from './integratedProcedureDiagnosticConclusions';
import { type DiagnosticConclusion } from './deriveProcedureDiagnosticConclusions';
import { getEvidenceConfig } from '../intelligence/evidenceRegistry';
import { getPlatformRule } from '../knowledge/platformRegistry';
import { procedureComponentDisplayLabel } from './procedureComponentAliases';
import { matchProcedureBranch } from './evaluateProcedureMeasurement';
import { resolveProcedureStepMeasurementEvaluation } from './resolveProcedureStepMeasurementEvaluation';
import { getServiceProcedure } from './procedureRegistry';
import { getProcedureStep } from './procedureRunner';
import type {
  DiagnosticEffect,
  ProcedureRunState,
  ProcedureStep,
  ServiceProcedure,
} from './types';

export type ProcedureRunDisposition = 'success' | 'action_required';

export type ProcedureStepTone = 'success' | 'failure' | 'neutral';

function collectAppliedEffects(runState: ProcedureRunState): DiagnosticEffect[] {
  return (runState.appliedDiagnosticEffects || []).flatMap((entry) => entry.effects);
}

function isActionOutcomeStepId(stepId: string): boolean {
  return /^replace_/i.test(stepId) || /^suspect_/i.test(stepId);
}

function isSuccessOutcomeStepId(stepId: string): boolean {
  return /verified$/i.test(stepId) || /path_verified$/i.test(stepId);
}

function componentLabel(
  procedure: ServiceProcedure | null | undefined,
  componentId: string,
): string {
  const displayLabel = procedureComponentDisplayLabel(componentId);
  if (displayLabel !== componentId) return displayLabel;

  const templateId = getPlatformRule(procedure?.platformId || '')?.templateId;
  const config = templateId ? getEvidenceConfig(templateId) : null;
  return config?.components?.find((item) => item.id === componentId)?.label || componentId;
}

/** Human repair line from a confirmed component — never guess door lock when CCU was confirmed. */
export function repairHeadlineFromConfirm(
  procedure: ServiceProcedure | null | undefined,
  componentId: string,
): string {
  switch (componentId) {
    case 'main_control':
      return 'Replace main control board';
    case 'inverter':
      return 'Replace inverter board';
    case 'control_board':
      return 'Replace CCU / main control board';
    case 'motor_controller':
      return 'Replace inverter board';
    case 'door_lock':
      return 'Replace door lock assembly';
    case 'hmi_control':
      return 'Replace HMI / UI control';
    default:
      return `Replace ${componentLabel(procedure, componentId)}`;
  }
}

function repairHeadlineFromOutcomeStep(step: ProcedureStep): string {
  if (/^suspect/i.test(step.title)) {
    return step.title.replace(/^Suspect\s+/i, 'Replace ');
  }
  if (/^replace/i.test(step.title)) {
    return step.title;
  }
  return step.title;
}

export function repairHeadlineFromDiagnosticConclusion(
  procedure: ServiceProcedure | null | undefined,
  conclusion: DiagnosticConclusion,
): string | null {
  switch (conclusion.kind) {
    case 'component_failed':
      if (conclusion.repairTargetHint === 'replace_float_switch') {
        return 'Replace overfill/float switch assembly';
      }
      if (conclusion.repairTargetHint === 'repair_float_harness') {
        return 'Repair harness or connections to float switch';
      }
      if (conclusion.repairTargetHint === 'replace_fill_valve') {
        return 'Replace fill valve';
      }
      if (conclusion.repairTargetHint === 'replace_acu') {
        return 'Replace ACU';
      }
      if (conclusion.repairTargetHint === 'replace_door_lock') {
        return 'Replace door lock';
      }
      if (conclusion.repairTargetHint === 'replace_door_switch') {
        return 'Replace door switch';
      }
      if (conclusion.repairTargetHint === 'replace_harness_door_lock') {
        return 'Replace door lock harness';
      }
      if (conclusion.repairTargetHint === 'replace_power_cord') {
        return 'Replace power cord';
      }
      if (conclusion.repairTargetHint === 'replace_rfi_filter') {
        return 'Replace RFI filter';
      }
      if (conclusion.repairTargetHint === 'repair_j2_harness') {
        return 'Repair J2 harness';
      }
      if (conclusion.repairTargetHint === 'repair_connections') {
        return 'Repair connections';
      }
      if (conclusion.evidenceSubjectKey === 'overfill_float') {
        return conclusion.oemNarrative?.title || 'Replace overfill/float switch assembly';
      }
      return repairHeadlineFromConfirm(procedure, conclusion.anchorComponentId);
    case 'external_path_fault':
      if (
        conclusion.anchorComponentId === 'inlet_valve'
        && conclusion.loadInstanceKey === 'cold_coil'
      ) {
        return 'Inspect/repair cold inlet valve coil circuit (VCH7 connectors and wiring)';
      }
      if (
        conclusion.anchorComponentId === 'drain_pump'
        && conclusion.loadInstanceKey === 'j4_pins_1_3'
      ) {
        return 'Inspect/repair drain pump J4-1 to J4-3 circuit (harness and connectors)';
      }
      return `Inspect/repair ${componentLabel(procedure, conclusion.anchorComponentId)} circuit (connectors and wiring)`;
    case 'contradicted':
    case 'inconclusive':
    case 'no_repair_target':
    case 'component_verified':
      return null;
    default:
      return null;
  }
}

export function resolveOutcomeStepFromRun(
  procedure: ServiceProcedure,
  runState: ProcedureRunState,
): ProcedureStep | null {
  const current = getProcedureStep(procedure, runState.currentStepId);
  if (current?.type === 'outcome') return current;

  const lastInteractiveStepId = [...runState.completedStepIds]
    .reverse()
    .find((stepId) => {
      const step = getProcedureStep(procedure, stepId);
      return step && step.type !== 'outcome';
    });

  if (!lastInteractiveStepId) return null;

  const step = getProcedureStep(procedure, lastInteractiveStepId);
  if (!step) return null;

  const input = runState.stepInputs[lastInteractiveStepId];
  let matchedBranch = null;

  if (step.type === 'measurement' && input?.kind === 'measurement') {
    const evaluation = resolveProcedureStepMeasurementEvaluation(
      runState,
      step,
      lastInteractiveStepId,
    );
    matchedBranch = matchProcedureBranch(step.branches, evaluation);
  } else if (step.branches?.length) {
    matchedBranch = matchProcedureBranch(step.branches, null, input?.value);
  }

  const appliedEntry = runState.appliedDiagnosticEffects?.find(
    (entry) => entry.stepId === lastInteractiveStepId,
  );
  if (appliedEntry?.branchId && step.branches?.length) {
    matchedBranch = step.branches.find((branch) => branch.id === appliedEntry.branchId) || matchedBranch;
  }

  if (!matchedBranch?.nextStepId) return null;

  const outcome = getProcedureStep(procedure, matchedBranch.nextStepId);
  return outcome?.type === 'outcome' ? outcome : null;
}

/** Derive the failed part / repair action strictly from run evidence. */
export function resolveProcedureRepairHeadline(
  procedure: ServiceProcedure | null | undefined,
  runState: ProcedureRunState,
): string | null {
  if (!procedure) return null;

  if (runUsesIntegratedDiagnosticConclusions(runState)) {
    const primary = resolveIntegratedPrimaryDiagnosticConclusion(runState, procedure);
    if (primary) {
      const structured = repairHeadlineFromDiagnosticConclusion(procedure, primary);
      if (structured) return structured;
      if (
        primary.kind === 'contradicted'
        || primary.kind === 'inconclusive'
        || primary.kind === 'no_repair_target'
      ) {
        return null;
      }
    }
  }

  const explicitConfirms = collectExplicitFailureConfirms(procedure, runState);
  if (explicitConfirms.length) {
    const lastConfirm = explicitConfirms[explicitConfirms.length - 1];
    return repairHeadlineFromConfirm(procedure, lastConfirm.componentId);
  }

  const outcomeStep = resolveOutcomeStepFromRun(procedure, runState);
  if (outcomeStep && isActionOutcomeStepId(outcomeStep.id)) {
    return repairHeadlineFromOutcomeStep(outcomeStep);
  }

  if (runState.oemOutcome && /(replace|suspect)/i.test(runState.oemOutcome)) {
    const short = runState.oemOutcome.match(/^[^.]+/);
    return short?.[0] || runState.oemOutcome;
  }

  return null;
}

export function resolveProcedureRunDisposition(
  runState: ProcedureRunState,
  procedure?: ServiceProcedure | null,
): ProcedureRunDisposition {
  const outcomeId = runState.currentStepId;

  if (isSuccessOutcomeStepId(outcomeId)) return 'success';

  if (procedure && runUsesIntegratedDiagnosticConclusions(runState)) {
    const primary = resolveIntegratedPrimaryDiagnosticConclusion(runState, procedure);
    if (primary?.kind === 'component_failed' || primary?.kind === 'external_path_fault') {
      return 'action_required';
    }
    if (
      primary?.kind === 'contradicted'
      || primary?.kind === 'inconclusive'
      || primary?.kind === 'no_repair_target'
    ) {
      const outcomeStep = procedure.steps.find((step) => step.id === outcomeId);
      if (outcomeStep?.type === 'outcome') {
        const title = outcomeStep.title.toLowerCase();
        if (title.includes('verified')) return 'success';
        if (title.includes('replace') || title.includes('suspect')) return 'action_required';
      }
      return 'success';
    }
  }

  const explicitConfirms = collectExplicitFailureConfirms(procedure, runState);
  if (explicitConfirms.length) return 'action_required';

  if (isActionOutcomeStepId(outcomeId)) return 'action_required';

  const outcomeStep = procedure?.steps.find((step) => step.id === outcomeId);
  if (outcomeStep?.type === 'outcome') {
    const title = outcomeStep.title.toLowerCase();
    if (title.includes('verified')) return 'success';
    if (title.includes('replace') || title.includes('suspect')) return 'action_required';
  }

  const outcomeFromRun = procedure ? resolveOutcomeStepFromRun(procedure, runState) : null;
  if (outcomeFromRun) {
    if (isActionOutcomeStepId(outcomeFromRun.id)) return 'action_required';
    const outcomeTitle = outcomeFromRun.title.toLowerCase();
    if (outcomeTitle.includes('replace') || outcomeTitle.includes('suspect')) {
      return 'action_required';
    }
  }

  if (runState.oemOutcome && /(replace|suspect|failed|no energize)/i.test(runState.oemOutcome)) {
    return 'action_required';
  }

  return 'success';
}

export interface ProcedureRunPresentation {
  disposition: ProcedureRunDisposition;
  headline: string;
  subline?: string;
}

export function resolveProcedureRunPresentation(
  procedureId: string,
  runState: ProcedureRunState,
): ProcedureRunPresentation {
  const procedure = getServiceProcedure(procedureId);
  const disposition = resolveProcedureRunDisposition(runState, procedure);

  if (disposition === 'action_required') {
    const repairHeadline = resolveProcedureRepairHeadline(procedure, runState);

    return {
      disposition,
      headline: repairHeadline || 'Repair action identified',
      subline: procedure?.title,
    };
  }

  const outcomeStep = procedure?.steps.find((step) => step.id === runState.currentStepId);
  const headline = runState.oemOutcome
    || outcomeStep?.title
    || procedure?.title
    || procedureId;

  return {
    disposition,
    headline,
    subline: procedure?.title && headlineDiffers(procedure.title, headline)
      ? procedure.title
      : undefined,
  };
}

function headlineDiffers(procedureTitle: string, headline?: string): boolean {
  if (!headline) return true;
  return procedureTitle.trim().toLowerCase() !== headline.trim().toLowerCase();
}

export function resolveProcedureStepTone(
  stepId: string,
  stepType: string,
  inputValue?: string,
  evaluationStatus?: string,
  effects: DiagnosticEffect[] = [],
): ProcedureStepTone {
  if (stepType === 'outcome') {
    if (isActionOutcomeStepId(stepId)) return 'failure';
    if (isSuccessOutcomeStepId(stepId)) return 'success';
  }

  if (
    effects.some(
      (effect) => effect.type === 'confirm' && isExplicitFailureEvidenceId(effect.evidenceId),
    )
  ) {
    return 'failure';
  }

  const normalizedInput = String(inputValue ?? '').trim().toLowerCase();
  if (normalizedInput === 'no' || normalizedInput === 'fail') return 'failure';

  if (
    evaluationStatus
    && ['open', 'critical', 'warning'].includes(evaluationStatus)
  ) {
    return 'failure';
  }

  if (effects.some((effect) => effect.type === 'eliminate')) return 'success';
  if (evaluationStatus === 'normal') return 'success';

  return 'neutral';
}
