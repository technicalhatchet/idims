import {
  executeProcedureContinuationPlan,
  type ProcedureContinuationHandlers,
  type ProcedureContinuationPlan,
} from './planContinuationAfterProcedureComplete';

/**
 * Work-order OEM handoff: jump to the OEM wizard step for next_oem but do not auto-start the runner.
 * Ranking/plan output is unchanged; only foreground launch behavior differs.
 */
export function executeOemWizardContinuationHandoff(
  plan: ProcedureContinuationPlan,
  handlers: ProcedureContinuationHandlers,
): void {
  if (plan.type === 'next_oem') {
    handlers.jumpToStepKey('oem_test');
    return;
  }
  executeProcedureContinuationPlan(plan, handlers);
}
