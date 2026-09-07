import type { DiagnosticEffect } from './types';

/** Light POC hook — Solomon scoring integration comes in a later phase. */
export interface ProcedureDiagnosticEffectResult {
  applied: DiagnosticEffect[];
  notes: string[];
}

export function applyProcedureDiagnosticEffects(
  effects: DiagnosticEffect[] | undefined,
): ProcedureDiagnosticEffectResult {
  if (!effects?.length) {
    return { applied: [], notes: [] };
  }

  const notes = effects.map((effect) => {
    const verb =
      effect.type === 'confirm'
        ? 'confirm'
        : effect.type === 'eliminate'
          ? 'eliminate'
          : 'suspect';
    const evidence = effect.evidenceId ? ` (${effect.evidenceId})` : '';
    return `${verb} ${effect.componentId}${evidence}`;
  });

  return { applied: effects, notes };
}
