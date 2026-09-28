import type { ResolvedDiagnosticGraph } from './canonicalTypes';

function normalizeAliasKey(value: string): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Resolve an OEM / manufacturer term to a canonical component id.
 * Overlay aliases win; returns input unchanged when no mapping exists.
 */
export function resolveOemTermToCanonicalId(
  term: string,
  graph: ResolvedDiagnosticGraph | null | undefined,
): string {
  if (!graph?.oemTermAliases) return term;
  const normalized = normalizeAliasKey(term);
  for (const [oemTerm, canonicalId] of Object.entries(graph.oemTermAliases)) {
    if (normalizeAliasKey(oemTerm) === normalized) {
      return canonicalId;
    }
  }
  return term;
}

/** Canonical id → manufacturer-facing display label for UI. */
export function resolveCanonicalDisplayTerm(
  canonicalId: string,
  graph: ResolvedDiagnosticGraph | null | undefined,
  fallback?: string,
): string {
  if (!graph) return fallback || canonicalId;
  return graph.displayTerms?.[canonicalId] || fallback || canonicalId;
}

export function resolveProcedureIdToTestTargetId(
  procedureId: string,
  graph: ResolvedDiagnosticGraph | null | undefined,
): string | null {
  if (!graph?.procedureBindings?.length) return null;
  const binding = graph.procedureBindings.find((item) => item.procedureId === procedureId);
  return binding?.testTargetId ?? null;
}

export function resolveTestTargetIdToProcedureIds(
  testTargetId: string,
  graph: ResolvedDiagnosticGraph | null | undefined,
): string[] {
  if (!graph?.procedureBindings?.length) return [];
  return graph.procedureBindings
    .filter((item) => item.testTargetId === testTargetId)
    .map((item) => item.procedureId);
}
