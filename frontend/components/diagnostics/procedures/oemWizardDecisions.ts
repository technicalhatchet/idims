import type { ProcedureRunState } from './types';
/** Per-procedure OEM wizard lead decision — not a global diagnostic suppressor. */
export type OemWizardLeadDecisionKind = 'skipped' | 'user_verified';

export interface OemWizardLeadDecision {
  procedureId: string;
  kind: OemWizardLeadDecisionKind;
  at: string;
}

export type OemWizardLeadDecisions = Record<string, OemWizardLeadDecision>;

/**
 * OEM procedure the user is acting on in the wizard lead UI.
 * Active runner (slot) wins over the ranked offer when both are present.
 */
export function resolveOemWizardDisplayedProcedureId(input: {
  activeProcedureId?: string | null;
  offeredProcedureId?: string | null;
}): string | null {
  const active = input.activeProcedureId?.trim();
  if (active) return active;
  const offered = input.offeredProcedureId?.trim();
  return offered || null;
}

export function recordOemWizardLeadDecision(
  decisions: OemWizardLeadDecisions | undefined,
  procedureId: string,
  kind: OemWizardLeadDecisionKind,
): OemWizardLeadDecisions {
  return {
    ...(decisions || {}),
    [procedureId]: {
      procedureId,
      kind,
      at: new Date().toISOString(),
    },
  };
}

/** Legacy global flag — treat as skip for all procedures (migrate away). */
export function hasLegacyGlobalOemSkip(skippedOemWizardStep?: boolean): boolean {
  return Boolean(skippedOemWizardStep);
}

export function isOemWizardLeadSuppressedForProcedure(
  procedureId: string | null | undefined,
  decisions: OemWizardLeadDecisions | undefined,
): boolean {
  if (!procedureId) return false;
  const decision = decisions?.[procedureId];
  return decision?.kind === 'skipped' || decision?.kind === 'user_verified';
}

export function shouldOfferOemWizardLead(
  recommendation: ProcedureRecommendation | null | undefined,
  decisions: OemWizardLeadDecisions | undefined,
): boolean {
  if (!recommendation) return false;
  return !isOemWizardLeadSuppressedForProcedure(recommendation.procedureId, decisions);
}

/** Clear skip-only decisions when user navigates back to re-open the OEM decision point. */
export function clearOemWizardSkipsOnReentry(
  decisions: OemWizardLeadDecisions | undefined,
  stepKey: string | null | undefined,
): OemWizardLeadDecisions | undefined {
  if (stepKey !== 'oem_test' || !decisions) return decisions;
  const next: OemWizardLeadDecisions = { ...decisions };
  for (const [id, decision] of Object.entries(next)) {
    if (decision.kind === 'skipped') {
      delete next[id];
    }
  }
  return Object.keys(next).length ? next : undefined;
}

export function isOemProcedureCompletedForPresentation(
  procedureId: string,
  procedureRuns: Record<string, ProcedureRunState> | undefined,
  decisions?: OemWizardLeadDecisions,
): boolean {
  const run = procedureRuns?.[procedureId];
  if (run?.status === 'completed') return true;
  return decisions?.[procedureId]?.kind === 'user_verified';
}

export function isOemProcedureSkippedForPresentation(
  procedureId: string,
  decisions?: OemWizardLeadDecisions,
): boolean {
  return decisions?.[procedureId]?.kind === 'skipped';
}

export function partitionOemCatalogEntries(
  entries: ProcedureRecommendation[],
  procedureRuns: Record<string, ProcedureRunState> | undefined,
  decisions?: OemWizardLeadDecisions,
): {
  available: ProcedureRecommendation[];
  completed: ProcedureRecommendation[];
  skipped: ProcedureRecommendation[];
} {
  const available: ProcedureRecommendation[] = [];
  const completed: ProcedureRecommendation[] = [];
  const skipped: ProcedureRecommendation[] = [];

  for (const entry of entries) {
    const procedureId = entry.procedureId;
    if (isOemProcedureCompletedForPresentation(procedureId, procedureRuns, decisions)) {
      completed.push(entry);
    } else if (isOemProcedureSkippedForPresentation(procedureId, decisions)) {
      skipped.push(entry);
    } else {
      available.push(entry);
    }
  }

  return { available, completed, skipped };
}

/** Wizard OEM step: skip / already verified only while a procedure is being offered, not during active run. */
export function shouldShowOemWizardDecisionControls(input: {
  readOnly?: boolean;
  hasActiveRunner: boolean;
  offeredProcedureId: string | null | undefined;
  procedureRuns?: Record<string, ProcedureRunState>;
  decisions?: OemWizardLeadDecisions;
}): boolean {
  if (input.readOnly) return false;
  if (input.hasActiveRunner) return false;
  const offeredId = input.offeredProcedureId?.trim();
  if (!offeredId) return false;
  if (
    isOemProcedureCompletedForPresentation(
      offeredId,
      input.procedureRuns,
      input.decisions,
    )
  ) {
    return false;
  }
  return true;
}
