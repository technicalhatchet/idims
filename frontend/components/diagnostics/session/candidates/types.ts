export type NextTestCandidateType = 'wizard_step' | 'service_procedure';

export type NextTestCandidateSourceSystem = 'wizard' | 'oem' | 'canonical' | 'branch';

export interface NextTestCandidateSource {
  system: NextTestCandidateSourceSystem;
  id: string;
}

export interface NextTestCandidateScoreBreakdown {
  existingSystemBoost: number;
  hypothesisAlignment: number;
  routingFit: number;
  branchBoost: number;
  measurementBoost: number;
  deprioritizationPenalty: number;
  repeatPenalty: number;
}

export interface NextTestCandidate {
  id: string;
  type: NextTestCandidateType;
  /** Primary component or step target for display / future canonical wiring. */
  target: string | null;
  source: NextTestCandidateSource;
  wizardStepKey: string | null;
  procedureId: string | null;
  score: number;
  scoreBreakdown: NextTestCandidateScoreBreakdown;
  eligible: boolean;
  blockedReason?: string | null;
  reason?: string;
  label?: string;
}

export interface DiagnosticCandidateWeights {
  existingSystemBoost: number;
  hypothesisAlignment: number;
  routingFit: number;
  branchBoost: number;
  measurementBoost: number;
  deprioritizationPenalty: number;
  repeatPenalty: number;
}

export function createEmptyScoreBreakdown(): NextTestCandidateScoreBreakdown {
  return {
    existingSystemBoost: 0,
    hypothesisAlignment: 0,
    routingFit: 0,
    branchBoost: 0,
    measurementBoost: 0,
    deprioritizationPenalty: 0,
    repeatPenalty: 0,
  };
}
