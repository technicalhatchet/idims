import type { DiagnosticSession } from '../types';
import type { NextTestCandidate } from './types';

/** DS-4 — branch extension candidates. Stub returns empty in DS-2. */
export function collectBranchCandidates(
  _session: DiagnosticSession,
): NextTestCandidate[] {
  return [];
}
