import type {
  DiagnosticEffect,
  EffectAssertion,
  MeasurementScope,
} from './types';

/** True when the effect uses the scoped assertion vocabulary (not legacy type-only semantics). */
export function isScopedDiagnosticEffect(effect: DiagnosticEffect): boolean {
  return Boolean(effect.assertion);
}

export function resolveEffectAssertion(effect: DiagnosticEffect): EffectAssertion | null {
  if (effect.assertion) return effect.assertion;
  return null;
}

export function resolveEffectMeasurementScope(
  effect: DiagnosticEffect,
  stepScope?: MeasurementScope,
): MeasurementScope | undefined {
  return effect.measurementScope ?? stepScope;
}

export function buildTestPointKey(
  stepId: string,
  connector?: string,
  pins?: string,
  explicitKey?: string,
): string {
  if (explicitKey) return explicitKey;
  if (connector && pins) return `${stepId}:${connector}:${pins}`;
  return stepId;
}
