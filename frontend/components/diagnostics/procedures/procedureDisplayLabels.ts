import type { ProcedureStep, ServiceModeBundle, ServiceProcedure } from './types';

const SECTION_SYMBOL_PATTERN = /\u00a7|§/g;

/** Remove legal-style section symbols from user-facing labels. */
export function stripSectionSymbol(text: string | null | undefined): string {
  if (!text) return '';
  return String(text).replace(SECTION_SYMBOL_PATTERN, '').replace(/  +/g, ' ').trim();
}

/** OEM cross-reference for dev tooling — no section symbol. */
export function formatOemTestLabel(oemTestNumber: string | null | undefined): string {
  if (!oemTestNumber) return '';
  const raw = String(oemTestNumber);
  return raw.includes('-') ? raw : `TEST #${raw}`;
}

function sanitizeStepLabels(step: ProcedureStep): ProcedureStep {
  return {
    ...step,
    title: stripSectionSymbol(step.title),
  };
}

export function sanitizeServiceProcedureLabels(procedure: ServiceProcedure): ServiceProcedure {
  return {
    ...procedure,
    title: stripSectionSymbol(procedure.title),
    steps: procedure.steps.map(sanitizeStepLabels),
  };
}

export function sanitizeServiceModeBundleLabels(bundle: ServiceModeBundle): ServiceModeBundle {
  return {
    ...bundle,
    title: stripSectionSymbol(bundle.title),
    description: bundle.description ? stripSectionSymbol(bundle.description) : bundle.description,
    steps: bundle.steps.map(sanitizeStepLabels),
  };
}
