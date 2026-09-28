import type { DiagnosticEffect, ProcedureRunState } from './types';

/** Procedure-local subject for P6-7/9 fill valve coil checks in overfill circuit test. */
export const FILL_VALVE_COIL_SUBJECT = 'fill_valve_coil';

/** Procedure-local subject for P6-4/6 overfill float switch positional checks. */
export const OVERFILL_FLOAT_SUBJECT = 'overfill_float';

export function runHasEvidenceSubjectKeys(runState: ProcedureRunState): boolean {
  for (const entry of runState.appliedDiagnosticEffects || []) {
    if (entry.effects.some((effect) => Boolean(effect.evidenceSubjectKey))) {
      return true;
    }
  }
  return false;
}

/** Subject keys that still update the procedure routing componentId score (Gate 7A valve coil). */
const SUBJECT_KEYS_APPLY_TO_ROUTING_COMPONENT = new Set<string>([FILL_VALVE_COIL_SUBJECT]);

/** When false, legacy component score updates for effect.componentId are skipped. */
export function appliesProcedureEffectToComponentScore(effect: DiagnosticEffect): boolean {
  if (!effect.evidenceSubjectKey) return true;
  if (effect.repairTargetHint === 'replace_acu') return false;
  if (SUBJECT_KEYS_APPLY_TO_ROUTING_COMPONENT.has(effect.evidenceSubjectKey)) return true;
  return false;
}

export function isEvidenceSubjectExplicitFailureConfirm(effect: DiagnosticEffect): boolean {
  if (effect.type !== 'confirm') return false;
  if (!effect.evidenceSubjectKey) return false;
  if (effect.evidenceSubjectKey === OVERFILL_FLOAT_SUBJECT) {
    return Boolean(
      effect.evidenceId?.includes('overfill_float')
      && effect.evidenceId?.includes('failed'),
    );
  }
  if (effect.evidenceSubjectKey === FILL_VALVE_COIL_SUBJECT) {
    return Boolean(
      effect.evidenceId?.startsWith('confirm_')
      && effect.evidenceId?.includes('failed'),
    );
  }
  return Boolean(effect.evidenceId?.includes('failed'));
}

/** Subject-keyed confirms do not hard-fail the routing component via legacy explicit-confirm rules. */
export function isLegacyExplicitProcedureFailureConfirm(effect: DiagnosticEffect): boolean {
  if (effect.evidenceSubjectKey && !SUBJECT_KEYS_APPLY_TO_ROUTING_COMPONENT.has(effect.evidenceSubjectKey)) {
    return false;
  }
  return true;
}
