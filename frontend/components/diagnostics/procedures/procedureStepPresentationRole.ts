import { getServiceModeBundle } from './procedureRegistry';
import type { ProcedureStep, ServiceProcedure } from './types';

export type ProcedureStepPresentationRole =
  | 'service_mode'
  | 'component_test'
  | 'safety'
  | 'interpretation'
  | 'instruction';

const SERVICE_MODE_STEP_ID_PREFIX = /^sm_/;

export function collectServiceModeInjectedStepIds(
  procedure: ServiceProcedure | null | undefined,
): Set<string> {
  const ids = new Set<string>();
  if (!procedure?.serviceModePlan?.length) return ids;

  for (const ref of procedure.serviceModePlan) {
    const bundle = getServiceModeBundle(ref.bundleId);
    if (!bundle) continue;
    for (const step of bundle.steps) {
      ids.add(step.id);
    }
    if (bundle.entryStepId) ids.add(bundle.entryStepId);
  }

  return ids;
}

export function resolveProcedureStepPresentationRole(
  procedure: ServiceProcedure | null | undefined,
  step: ProcedureStep,
): ProcedureStepPresentationRole {
  if (!procedure || !step) return 'instruction';

  const serviceModeIds = collectServiceModeInjectedStepIds(procedure);
  if (serviceModeIds.has(step.id) || SERVICE_MODE_STEP_ID_PREFIX.test(step.id)) {
    return 'service_mode';
  }

  if (step.type === 'outcome') return 'interpretation';
  if (step.type === 'safety') return 'safety';
  if (step.type === 'measurement' || step.type === 'visual_check') {
    return 'component_test';
  }

  const title = step.title.toLowerCase();
  if (
    /\b(service|diagnostic)\s+mode\b/.test(title)
    || /\bmanual\s+diagnostic\b/.test(title)
    || /\btest\s+mode\b/.test(title)
  ) {
    return 'service_mode';
  }

  return 'instruction';
}

export function formatProcedureStepProgressLabel(
  stepIndex: number,
  stepTotal: number,
  role: ProcedureStepPresentationRole,
): string | null {
  if (stepIndex <= 0) return null;

  const suffix = stepTotal > 0 ? ` ${stepIndex} of ${stepTotal}` : ` ${stepIndex}`;
  switch (role) {
    case 'service_mode':
      return `Manufacturer setup step${suffix} (same procedure)`;
    case 'component_test':
      return `Component test step${suffix}`;
    case 'interpretation':
      return `Result step${suffix}`;
    case 'safety':
      return `Safety step${suffix}`;
    default:
      return `Procedure step${suffix}`;
  }
}
