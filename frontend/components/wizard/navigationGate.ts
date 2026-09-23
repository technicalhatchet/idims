import type { WizardNavigationGate } from '../diagnostics/procedures/oemProcedureNavGate';

export function readWizardNavigationGate(context: unknown): WizardNavigationGate | null {
  if (!context || typeof context !== 'object') return null;
  const gate = (context as { navigationGate?: WizardNavigationGate | null }).navigationGate;
  if (!gate?.blocked) return null;
  return gate;
}

export function isWizardNavigationBlocked(context: unknown): boolean {
  return readWizardNavigationGate(context) != null;
}
