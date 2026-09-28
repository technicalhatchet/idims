import type { DiagnosticCandidateWeights } from './types';

/** Phase 1 (DS-2): parity-first — legacy rankers supply `existingSystemBoost`. */
export const DEFAULT_DIAGNOSTIC_WEIGHTS: DiagnosticCandidateWeights = {
  existingSystemBoost: 1,
  hypothesisAlignment: 0,
  /** CG-1: conservative — canonical graph must not overpower proven OEM ranking. */
  routingFit: 0.25,
  branchBoost: 1,
  measurementBoost: 1,
  deprioritizationPenalty: 1,
  repeatPenalty: 1,
};
