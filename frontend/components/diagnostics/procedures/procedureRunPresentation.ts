import { getEvidenceConfig } from '../intelligence/evidenceRegistry';
import { getPlatformRule } from '../knowledge/platformRegistry';
import {
  evaluateProcedureMeasurement,
  matchProcedureBranch,
} from './evaluateProcedureMeasurement';
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
    case 'control_board':
      return 'Replace CCU / main control board';
    case 'door_lock':
      return 'Replace door lock assembly';
    case 'hmi_control':
      return 'Replace HMI / UI control';
    default:
      return `Replace ${componentLabel(procedure, componentId)}`;
  }
}

function repairHeadlineFromOutcomeStep(step: ProcedureStep): string {
  if (step.oemOutcome) {
    const replaceMatch = step.oemOutcome.match(/^Replace [^.]+/i);
    if (replaceMatch) return replaceMatch[0];
  }
  if (/^suspect/i.test(step.title)) {
    return step.title.replace(/^Suspect\s+/i, 'Replace ');
  }
  if (/^replace/i.test(step.title)) {
    return step.title;
  }
  return step.title;
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
    const evaluation = evaluateProcedureMeasurement(step.measurementKnowledgeId, input.value);
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

  const confirms = collectAppliedEffects(runState).filter((effect) => effect.type === 'confirm');
  if (confirms.length) {
    const lastConfirm = confirms[confirms.length - 1];
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

  const confirms = collectAppliedEffects(runState).filter((effect) => effect.type === 'confirm');
  if (confirms.length) return 'action_required';

  if (isActionOutcomeStepId(outcomeId)) return 'action_required';

  const outcomeStep = procedure?.steps.find((step) => step.id === outcomeId);
  if (outcomeStep?.type === 'outcome') {
    const title = outcomeStep.title.toLowerCase();
    if (title.includes('verified')) return 'success';
    if (title.includes('replace') || title.includes('suspect')) return 'action_required';
  }

  if (procedure && resolveOutcomeStepFromRun(procedure, runState)) {
    return 'action_required';
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

  if (effects.some((effect) => effect.type === 'confirm')) return 'failure';

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
