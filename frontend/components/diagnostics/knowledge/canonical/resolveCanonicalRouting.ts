import { getPlatformRule } from '../platformRegistry';
import { getCanonicalOntologyForTemplate, getPlatformOverlayForOntology } from './canonicalRegistry';
import type {
  CanonicalEntryPointMatch,
  CanonicalRoutingResult,
} from './canonicalTypes';
import { getServiceProceduresForPlatform } from '../../procedures/procedureRegistry';
import { resolveProcedureComponentForEvidence } from '../../procedures/procedureComponentAliases';
import type { ServiceProcedure } from '../../procedures/types';

const CHIP_TO_ENTRY_POINTS: Record<string, string[]> = {
  wont_drain: ['wont_drain'],
  wont_spin: ['wont_spin'],
  wont_agitate: ['wont_tumble'],
  no_fill: ['wont_fill'],
  lid_lock: ['door_lock_issue', 'wont_start'],
  no_heat: ['no_heat'],
  leaking: ['leak'],
  noisy: ['excessive_noise'],
  vibration: ['vibration_unbalance'],
  error_code: ['error_code_displayed'],
  dispenser_check: ['dispenser_issue'],
};

function normalizeToken(value: string): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeErrorCode(value: string): string {
  const compact = normalizeToken(value).replace(/[^a-z0-9]/g, '');
  const fMatch = compact.match(/^f(\d+)(e(\d+))?$/);
  if (fMatch) {
    if (fMatch[3]) return `f${fMatch[1]}e${fMatch[3]}`;
    return `f${fMatch[1]}`;
  }
  return compact;
}

function symptomMatchesToken(symptom: string, token: string): boolean {
  const s = normalizeToken(symptom);
  const t = normalizeToken(token);
  if (!s || !t) return false;
  if (s === t) return true;
  if (normalizeErrorCode(s) === normalizeErrorCode(t)) return true;
  return s.includes(t) || t.includes(s);
}

export interface ResolveCanonicalRoutingInput {
  templateId?: string | null;
  platformId?: string | null;
  complaintChipIds?: string[];
  errorCodes?: string[];
  complaintText?: string;
}

export function resolveCanonicalRouting(
  input: ResolveCanonicalRoutingInput,
): CanonicalRoutingResult | null {
  const ontology = getCanonicalOntologyForTemplate(input.templateId, input.platformId);
  if (!ontology) return null;

  const domainLabelMap = Object.fromEntries(
    (ontology.failureDomains || [])
      .filter((domain) => domain.id)
      .map((domain) => [domain.id, domain.label || domain.id]),
  );

  const entryById = new Map(
    (ontology.diagnosticEntryPoints || []).map((entry) => [entry.id, entry]),
  );

  const matches = new Map<string, CanonicalEntryPointMatch>();

  for (const chipId of input.complaintChipIds || []) {
    const entryIds = CHIP_TO_ENTRY_POINTS[chipId] || [];
    for (const entryId of entryIds) {
      const entry = entryById.get(entryId);
      if (!entry) continue;
      const existing = matches.get(entryId);
      if (existing) {
        if (!existing.matchedBy.includes('chip')) existing.matchedBy.push('chip');
        existing.matchDetail = `${existing.matchDetail}, chip:${chipId}`;
      } else {
        matches.set(entryId, {
          entryPointId: entryId,
          matchedBy: ['chip'],
          matchDetail: `chip:${chipId}`,
          initialDomains: entry.initialDomains,
        });
      }
    }
  }

  for (const code of input.errorCodes || []) {
    for (const entry of ontology.diagnosticEntryPoints || []) {
      const hit = (entry.symptoms || []).some((symptom) => symptomMatchesToken(symptom, code));
      if (!hit) continue;
      const existing = matches.get(entry.id);
      if (existing) {
        if (!existing.matchedBy.includes('error_code')) existing.matchedBy.push('error_code');
        existing.matchDetail = `${existing.matchDetail}, code:${code}`;
      } else {
        matches.set(entry.id, {
          entryPointId: entry.id,
          matchedBy: ['error_code'],
          matchDetail: `code:${code}`,
          initialDomains: entry.initialDomains,
        });
      }
    }
  }

  const complaintText = normalizeToken(input.complaintText || '');
  if (complaintText) {
    for (const entry of ontology.diagnosticEntryPoints || []) {
      const hit = (entry.symptoms || []).some((symptom) => complaintText.includes(normalizeToken(symptom)));
      if (!hit) continue;
      const existing = matches.get(entry.id);
      if (existing) {
        if (!existing.matchedBy.includes('text')) existing.matchedBy.push('text');
        existing.matchDetail = `${existing.matchDetail}, text`;
      } else {
        matches.set(entry.id, {
          entryPointId: entry.id,
          matchedBy: ['text'],
          matchDetail: 'complaint text',
          initialDomains: entry.initialDomains,
        });
      }
    }
  }

  const matchedEntryPoints = [...matches.values()];
  const activeDomains = [...new Set(matchedEntryPoints.flatMap((match) => match.initialDomains))];

  const componentSet = new Set<string>();
  for (const domainId of activeDomains) {
    const domain = ontology.failureDomains.find((item) => item.id === domainId);
    for (const componentId of domain?.components || []) {
      componentSet.add(componentId);
    }
  }

  let overlayProcedureCount = 0;
  let unmappedProcedureCount = 0;
  const resolvedPlatformId = input.platformId || null;
  if (resolvedPlatformId) {
    const overlay = getPlatformOverlayForOntology(ontology.ontology.id, resolvedPlatformId);
    const procedures = getServiceProceduresForPlatform(resolvedPlatformId);
    for (const procedure of procedures) {
      const domains = getProcedureFailureDomains(procedure, ontology, overlay);
      if (domains.length) overlayProcedureCount += 1;
      else unmappedProcedureCount += 1;
    }
  }

  return {
    ontologyId: ontology.ontology.id,
    ontologyLabel: ontology.ontology.name,
    matchedEntryPoints,
    activeDomains,
    domainLabels: Object.fromEntries(activeDomains.map((id) => [id, domainLabelMap[id] || id])),
    suggestedComponents: [...componentSet],
    overlayPlatformId: resolvedPlatformId,
    overlayProcedureCount,
    unmappedProcedureCount,
  };
}

export function getProcedureFailureDomains(
  procedure: ServiceProcedure,
  ontology = getCanonicalOntologyForTemplate('washer'),
  platformOverlay = ontology
    ? getPlatformOverlayForOntology(ontology.ontology.id, procedure.platformId)
    : null,
): string[] {
  if (!ontology) return [];

  const overlayEntry = platformOverlay?.procedures?.find(
    (entry) =>
      entry.procedureId === procedure.id
      || entry.seedProcedureId === procedure.id,
  );
  if (overlayEntry?.failureDomains?.length) {
    return overlayEntry.failureDomains;
  }

  const aliasContext = {
    platformId: procedure.platformId,
    templateId: getPlatformRule(procedure.platformId)?.templateId,
    procedureId: procedure.id,
  };

  const domains = new Set<string>();
  for (const componentId of procedure.componentIds || []) {
    const canonicalId = resolveProcedureComponentForEvidence(componentId, aliasContext);
    for (const domain of ontology.failureDomains) {
      if (domain.components?.includes(canonicalId)) {
        domains.add(domain.id);
      }
    }
  }
  return [...domains];
}

export const CANONICAL_DOMAIN_MATCH_BOOST = 18;

export function scoreCanonicalDomainBoost(
  procedure: ServiceProcedure,
  activeDomains: string[],
  ontology = getCanonicalOntologyForTemplate('washer'),
): { boost: number; matches: string[] } {
  if (!ontology || !activeDomains.length) {
    return { boost: 0, matches: [] };
  }

  const overlay = getPlatformOverlayForOntology(ontology.ontology.id, procedure.platformId);
  const procedureDomains = getProcedureFailureDomains(procedure, ontology, overlay);
  const matches = activeDomains.filter((domainId) => procedureDomains.includes(domainId));
  return {
    boost: matches.length * CANONICAL_DOMAIN_MATCH_BOOST,
    matches,
  };
}
