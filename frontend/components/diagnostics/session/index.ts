export type {
  DiagnosticSession,
  DiagnosticSessionPayload,
  DiagnosticSessionStatus,
  DiagnosticSymptom,
  DiagnosticSymptomSource,
  DiagnosticWizardMode,
  LooseDiagnosticPayload,
} from './types';

export { hydrateDiagnosticSession } from './hydrateDiagnosticSession';
export type { HydrateDiagnosticSessionInput } from './hydrateDiagnosticSession';

export { serializeDiagnosticSession } from './serializeDiagnosticSession';
export { normalizeDiagnosticSessionPayload } from './normalizeDiagnosticSessionPayload';
export { buildSessionSymptoms } from './buildSessionSymptoms';
export { resolveDiagnosticSessionStatus } from './resolveSessionStatus';

export { extractDiagnosticSessionFields } from './diagnosticSessionPayload.js';

export {
  getNextDiagnosticActions,
  replanDiagnosticActions,
  resolveLegacyDiagnosticLeader,
} from './getNextDiagnosticActions';

export { deriveBranchCandidateAdjustments } from './candidates/branchEffects';
export { deriveMeasurementCandidateAdjustments } from './candidates/measurementEffects';
export { appendResolvedBranchEvent } from './appendResolvedBranchEvent';

export {
  extractUnifiedTopProcedureId,
  extractUnifiedWizardStepKeys,
  resolveUnifiedOemLeadRecommendation,
  resolveUnifiedTopWizardStepKey,
} from './deriveUnifiedDiagnosticPresentation';
export type {
  GetNextDiagnosticActionsInput,
  GetNextDiagnosticActionsResult,
  NextTestCandidate,
} from './getNextDiagnosticActions';
export type { DiagnosticWizardRankContext } from './candidates/candidateContext';
