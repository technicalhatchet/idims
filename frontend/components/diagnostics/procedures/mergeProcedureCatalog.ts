import { getServiceProcedure } from './procedureRegistry';
import type { ProcedureRecommendation } from './recommendServiceProcedures';

function compareOemTestNumber(a: string, b: string): number {
  const parse = (value: string) => {
    const match = value.match(/^(\d+)([a-z]*)$/i);
    if (!match) return { num: 999, suffix: value.toLowerCase() };
    return { num: Number.parseInt(match[1], 10), suffix: (match[2] || '').toLowerCase() };
  };
  const left = parse(a);
  const right = parse(b);
  if (left.num !== right.num) return left.num - right.num;
  return left.suffix.localeCompare(right.suffix);
}

/**
 * Ensure route / ranker procedures appear in the All OEM Tests catalog (single discoverability surface).
 */
export function mergeProcedureCatalogWithRouteProcedures(
  catalog: ProcedureRecommendation[],
  routeProcedureIds: string[],
  rankedRecommendations: ProcedureRecommendation[] = [],
): ProcedureRecommendation[] {
  const byId = new Map<string, ProcedureRecommendation>();
  for (const entry of catalog) {
    byId.set(entry.procedureId, entry);
  }
  for (const entry of rankedRecommendations) {
    if (!byId.has(entry.procedureId)) {
      byId.set(entry.procedureId, entry);
    }
  }
  for (const procedureId of routeProcedureIds) {
    if (byId.has(procedureId)) continue;
    const procedure = getServiceProcedure(procedureId);
    if (!procedure) continue;
    byId.set(procedureId, {
      procedureId,
      procedure,
      reason: '',
      priority: 0,
    });
  }
  return [...byId.values()].sort((a, b) =>
    compareOemTestNumber(a.procedure.source.oemTestNumber, b.procedure.source.oemTestNumber),
  );
}
