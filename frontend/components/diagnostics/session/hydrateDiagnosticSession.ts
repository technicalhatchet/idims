import { getCanonicalOntologyForTemplate } from '../knowledge/canonical/canonicalRegistry';
import { buildMeasurementContext, resolvePlatformIdFromModel } from '../knowledge/platformRegistry';
import { normalizeDiagnosticSessionPayload } from './normalizeDiagnosticSessionPayload';
import { buildSessionSymptoms } from './buildSessionSymptoms';
import { resolveDiagnosticSessionStatus } from './resolveSessionStatus';
import type {
  DiagnosticSession,
  DiagnosticSessionDerived,
  LooseDiagnosticPayload,
} from './types';
import type { EliminationEvaluationResult } from '../knowledge/types';
import type { DiagnosticIntelligenceResult } from '../intelligence/evidenceTypes';

export interface HydrateDiagnosticSessionInput {
  payload: LooseDiagnosticPayload | null | undefined;
  workOrder?: Record<string, unknown> | null;
  /** Override when WO id / note id is known at hydrate time. */
  sessionId?: string;
  derived?: {
    intelligence?: DiagnosticIntelligenceResult | null;
    elimination?: EliminationEvaluationResult | null;
  };
  fallbackTemplateId?: string;
}

function resolveSessionId(
  payloadSessionId: string | null | undefined,
  explicitSessionId: string | undefined,
  templateId: string,
  appointmentId: string,
): string {
  if (explicitSessionId) return explicitSessionId;
  if (payloadSessionId) return payloadSessionId;
  const appt = appointmentId || 'no-appointment';
  return `diag:${templateId}:${appt}`;
}

function buildDerived(derived?: HydrateDiagnosticSessionInput['derived']): DiagnosticSessionDerived | undefined {
  if (!derived) return undefined;
  return {
    intelligence: derived.intelligence ?? null,
    elimination: derived.elimination ?? null,
    hydratedAt: new Date().toISOString(),
  };
}

export function hydrateDiagnosticSession(input: HydrateDiagnosticSessionInput): DiagnosticSession {
  const payload = normalizeDiagnosticSessionPayload(
    input.payload,
    input.fallbackTemplateId,
  );

  const workOrder = input.workOrder || null;
  const manufacturer = workOrder?.equipment_make
    ? String(workOrder.equipment_make)
    : null;
  const model = workOrder?.equipment_model
    ? String(workOrder.equipment_model)
    : null;

  const measurementContext = buildMeasurementContext({
    templateId: payload.templateId,
    equipmentMake: manufacturer,
    equipmentModel: model,
  });
  const platform = resolvePlatformIdFromModel(measurementContext);
  const ontologyRecord = getCanonicalOntologyForTemplate(payload.templateId);
  const ontology = ontologyRecord?.ontology.id || payload.templateId;

  const sessionId = resolveSessionId(
    payload._diagnosticSessionId,
    input.sessionId,
    payload.templateId,
    payload.appointmentId || '',
  );

  return {
    sessionId,
    appliance: {
      ontology,
      manufacturer,
      model,
      platform,
    },
    symptoms: buildSessionSymptoms(payload.fields),
    state: {
      status: resolveDiagnosticSessionStatus(payload),
      currentHypothesisId: null,
      currentComponentId: null,
    },
    navigation: {
      currentStepKey: payload.currentStepKey,
      visitedStepKeys: [...payload.visitedStepKeys],
      wizardMode: 'guided',
    },
    payload: {
      ...payload,
      _diagnosticSessionId: sessionId,
    },
    derived: buildDerived(input.derived),
  };
}
