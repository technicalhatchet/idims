import {
  FILL_VALVE_COIL_SUBJECT,
  OVERFILL_FLOAT_SUBJECT,
  isEvidenceSubjectExplicitFailureConfirm,
  runHasEvidenceSubjectKeys,
} from './procedureEvidenceSubject';
import { getProcedureStep } from './procedureRunner';
import type {
  DiagnosticConclusion,
  DiagnosticEffect,
  ProcedureRunState,
  ServiceProcedure,
} from './types';

function subjectInstanceKey(componentId: string, evidenceSubjectKey: string): string {
  return `${componentId}\0${evidenceSubjectKey}`;
}

function collectSubjectEffects(
  runState: ProcedureRunState,
): Array<DiagnosticEffect & { stepId: string; branchId?: string }> {
  const items: Array<DiagnosticEffect & { stepId: string; branchId?: string }> = [];
  for (const entry of runState.appliedDiagnosticEffects || []) {
    for (const effect of entry.effects) {
      if (!effect.evidenceSubjectKey) continue;
      items.push({ ...effect, stepId: entry.stepId, branchId: entry.branchId });
    }
  }
  return items;
}

function repairHintFromEffect(effect: DiagnosticEffect): string | undefined {
  if (effect.repairTargetHint) return effect.repairTargetHint;
  if (effect.evidenceId?.includes('overfill_float') && effect.type === 'confirm') {
    if (effect.repairTargetHint === 'repair_float_harness') return 'repair_float_harness';
    return 'replace_float_switch';
  }
  if (effect.evidenceSubjectKey === FILL_VALVE_COIL_SUBJECT && effect.type === 'confirm') {
    return 'replace_fill_valve';
  }
  return undefined;
}

function deriveForSubject(
  componentId: string,
  evidenceSubjectKey: string,
  effects: Array<DiagnosticEffect & { stepId: string; branchId?: string }>,
  procedure: ServiceProcedure,
  runState: ProcedureRunState,
): DiagnosticConclusion {
  const subjectEffects = effects.filter(
    (item) => item.componentId === componentId && item.evidenceSubjectKey === evidenceSubjectKey,
  );

  const failed = subjectEffects.some((effect) => isEvidenceSubjectExplicitFailureConfirm(effect));
  const sequenceVerified = subjectEffects.some(
    (effect) => effect.type === 'eliminate'
      && effect.evidenceId?.includes('position_sequence_ok'),
  );

  const lastFailed = [...subjectEffects]
    .reverse()
    .find((effect) => isEvidenceSubjectExplicitFailureConfirm(effect));

  let oemNarrative: DiagnosticConclusion['oemNarrative'];
  if (lastFailed?.stepId) {
    const step = getProcedureStep(procedure, lastFailed.stepId);
    const branch = step?.branches?.find((item) => item.id === lastFailed.branchId);
    const outcomeId = branch?.nextStepId;
    const outcome = outcomeId ? getProcedureStep(procedure, outcomeId) : null;
    if (outcome?.type === 'outcome') {
      oemNarrative = {
        outcomeStepId: outcome.id,
        title: outcome.title,
        oemOutcome: outcome.oemOutcome || outcome.body,
      };
    }
  }

  if (failed && sequenceVerified) {
    return {
      kind: 'contradicted',
      anchorComponentId: componentId,
      evidenceSubjectKey,
      componentState: 'unknown',
      oemNarrative,
    };
  }

  if (failed) {
    const repairTargetHint = lastFailed ? repairHintFromEffect(lastFailed) : undefined;
    if (!repairTargetHint && lastFailed?.stepId) {
      const step = getProcedureStep(procedure, lastFailed.stepId);
      const branch = step?.branches?.find((item) => item.id === lastFailed.branchId);
      const outcomeId = branch?.nextStepId;
      const outcome = outcomeId ? getProcedureStep(procedure, outcomeId) : null;
      if (outcome?.type === 'outcome') {
        if (outcome.id === 'replace_door_lock') {
          return {
            kind: 'component_failed',
            anchorComponentId: componentId,
            evidenceSubjectKey,
            componentState: 'verified_failed',
            repairTargetHint: 'replace_door_lock',
            oemNarrative: {
              outcomeStepId: outcome.id,
              title: outcome.title,
              oemOutcome: outcome.oemOutcome || outcome.body,
            },
          };
        }
      }
    }
    return {
      kind: 'component_failed',
      anchorComponentId: componentId,
      evidenceSubjectKey,
      componentState: 'verified_failed',
      repairTargetHint,
      oemNarrative,
    };
  }

  if (sequenceVerified) {
    return {
      kind: 'no_repair_target',
      anchorComponentId: componentId,
      evidenceSubjectKey,
      componentState: 'verified_good',
      oemNarrative,
    };
  }

  const partialVerified = subjectEffects.some((effect) => effect.type === 'eliminate');
  if (partialVerified) {
    return {
      kind: 'component_verified',
      anchorComponentId: componentId,
      evidenceSubjectKey,
      componentState: 'verified_good',
      oemNarrative,
    };
  }

  return {
    kind: 'inconclusive',
    anchorComponentId: componentId,
    evidenceSubjectKey,
    componentState: 'unknown',
    oemNarrative,
  };
}

export function deriveEvidenceSubjectConclusions(
  runState: ProcedureRunState,
  procedure: ServiceProcedure,
): DiagnosticConclusion[] {
  if (!runHasEvidenceSubjectKeys(runState)) {
    return [];
  }

  const effects = collectSubjectEffects(runState);
  const keys = [
    ...new Set(
      effects.map((item) => subjectInstanceKey(item.componentId, item.evidenceSubjectKey!)),
    ),
  ];

  return keys.map((key) => {
    const [componentId, evidenceSubjectKey] = key.split('\0', 2);
    return deriveForSubject(componentId, evidenceSubjectKey, effects, procedure, runState);
  });
}
