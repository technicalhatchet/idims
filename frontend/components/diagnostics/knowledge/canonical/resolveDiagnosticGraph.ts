import { getCanonicalOntologyForTemplate } from './canonicalRegistry';
import type {
  CanonicalDependency,
  CanonicalDiagnosticEntryPoint,
  CanonicalEstablishedFactSource,
  CanonicalFailureDomain,
  CanonicalOntology,
  CanonicalRelationship,
  CanonicalTestTarget,
  GraphOverride,
  ManufacturerGraphAdditions,
  ManufacturerOverlayFile,
  ModelOverlayFile,
  PlatformFamilyOverlay,
  ResolveDiagnosticGraphInput,
  ResolvedDiagnosticGraph,
  ResolutionTraceEntry,
} from './canonicalTypes';
import samsungFrontLoadWasherOverlay from './manufacturer_overlays/samsung_front_load_washer.json';
import samsungTopLoadWasherOverlay from './manufacturer_overlays/samsung_top_load_washer.json';
import samsungVentedDryerOverlay from './manufacturer_overlays/samsung_vented_dryer.json';
import whirlpoolFrontLoadWasherOverlay from './manufacturer_overlays/whirlpool_front_load_washer.json';
import whirlpoolTopLoadWasherOverlay from './manufacturer_overlays/whirlpool_top_load_washer.json';
import samsungDishwasherOverlay from './manufacturer_overlays/samsung_dishwasher.json';
import whirlpoolDishwasherOverlay from './manufacturer_overlays/whirlpool_dishwasher.json';
import lgLrmvsOverlay from './manufacturer_overlays/lg_lrmvs.json';
import samsungFridgeBespokeOverlay from './manufacturer_overlays/samsung_fridge_bespoke.json';
import samsungSxsOverlay from './manufacturer_overlays/samsung_sxs.json';
import whirlpoolJazzFrenchDoorOverlay from './manufacturer_overlays/whirlpool_jazz_french_door.json';
import whirlpoolSxsW11296289Overlay from './manufacturer_overlays/whirlpool_sxs_w11296289.json';
import lgSxsOverlay from './manufacturer_overlays/lg_sxs.json';
import mideaRssOverlay from './manufacturer_overlays/midea_rss.json';
import whirlpoolVentedDryerOverlay from './manufacturer_overlays/whirlpool_vented_dryer.json';
import samsungRangeNx60Overlay from './manufacturer_overlays/samsung_range_nx60.json';
import samsungRangeNe58Overlay from './manufacturer_overlays/samsung_range_ne58.json';
import samsungRangeNy63Overlay from './manufacturer_overlays/samsung_range_ny63.json';
import whirlpoolFreestandingRangeW11174814Overlay from './manufacturer_overlays/whirlpool_freestanding_range_w11174814.json';
import lgMicrowaveOtrOverlay from './manufacturer_overlays/lg_microwave_otr.json';
import samsungMicrowaveOtrOverlay from './manufacturer_overlays/samsung_microwave_otr.json';

const MANUFACTURER_OVERLAYS_BY_ONTOLOGY: Record<string, ManufacturerOverlayFile[]> = {
  front_load_washer: [
    whirlpoolFrontLoadWasherOverlay as unknown as ManufacturerOverlayFile,
    samsungFrontLoadWasherOverlay as unknown as ManufacturerOverlayFile,
  ],
  top_load_washer: [
    whirlpoolTopLoadWasherOverlay as unknown as ManufacturerOverlayFile,
    samsungTopLoadWasherOverlay as unknown as ManufacturerOverlayFile,
  ],
  vented_dryer: [
    whirlpoolVentedDryerOverlay as unknown as ManufacturerOverlayFile,
    samsungVentedDryerOverlay as unknown as ManufacturerOverlayFile,
  ],
  dishwasher: [
    whirlpoolDishwasherOverlay as unknown as ManufacturerOverlayFile,
    samsungDishwasherOverlay as unknown as ManufacturerOverlayFile,
  ],
  french_door_refrigerator: [
    whirlpoolJazzFrenchDoorOverlay as unknown as ManufacturerOverlayFile,
    samsungFridgeBespokeOverlay as unknown as ManufacturerOverlayFile,
    lgLrmvsOverlay as unknown as ManufacturerOverlayFile,
    samsungSxsOverlay as unknown as ManufacturerOverlayFile,
    whirlpoolSxsW11296289Overlay as unknown as ManufacturerOverlayFile,
    lgSxsOverlay as unknown as ManufacturerOverlayFile,
    mideaRssOverlay as unknown as ManufacturerOverlayFile,
  ],
  range_oven: [
    samsungRangeNx60Overlay as unknown as ManufacturerOverlayFile,
    samsungRangeNe58Overlay as unknown as ManufacturerOverlayFile,
    samsungRangeNy63Overlay as unknown as ManufacturerOverlayFile,
    whirlpoolFreestandingRangeW11174814Overlay as unknown as ManufacturerOverlayFile,
  ],
  microwave: [
    lgMicrowaveOtrOverlay as unknown as ManufacturerOverlayFile,
    samsungMicrowaveOtrOverlay as unknown as ManufacturerOverlayFile,
  ],
};

function cloneOntology(ontology: CanonicalOntology): CanonicalOntology {
  return JSON.parse(JSON.stringify(ontology)) as CanonicalOntology;
}

function normalizeToken(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function modelMatchesPattern(model: string, pattern: string): boolean {
  const normalizedModel = normalizeToken(model);
  const normalizedPattern = normalizeToken(pattern);
  if (!normalizedModel || !normalizedPattern) return false;
  if (normalizedPattern.endsWith('*')) {
    return normalizedModel.startsWith(normalizedPattern.slice(0, -1));
  }
  return normalizedModel === normalizedPattern;
}

function manufacturerMatches(
  sessionManufacturer: string | null | undefined,
  allowed: string[] | undefined,
): boolean {
  if (!allowed?.length) return true;
  if (!sessionManufacturer) return false;
  const normalized = normalizeToken(sessionManufacturer);
  return allowed.some((item) => normalizeToken(item) === normalized);
}

export function platformFamilyApplies(
  family: PlatformFamilyOverlay,
  input: ResolveDiagnosticGraphInput,
): boolean {
  const appliesTo = family.appliesTo || {};

  if (appliesTo.templateId && input.templateId !== appliesTo.templateId) {
    return false;
  }

  if (input.platformId) {
    if (family.platformId === input.platformId) return true;
    if (appliesTo.platformIds?.includes(input.platformId)) return true;
    // Explicit platform — do not fall through to model-pattern routing on a different family.
    return false;
  }

  if (input.model && appliesTo.modelPatterns?.length) {
    const modelHit = appliesTo.modelPatterns.some((pattern) =>
      modelMatchesPattern(input.model || '', pattern),
    );
    if (modelHit && manufacturerMatches(input.manufacturer, appliesTo.manufacturers)) {
      return true;
    }
  }

  if (
    input.platformId
    && family.platformId === input.platformId
    && manufacturerMatches(input.manufacturer, appliesTo.manufacturers)
  ) {
    return true;
  }

  return false;
}

export function selectPlatformFamilyOverlay(
  overlayFile: ManufacturerOverlayFile,
  input: ResolveDiagnosticGraphInput,
): PlatformFamilyOverlay | null {
  for (const family of overlayFile.platformFamilies || []) {
    if (platformFamilyApplies(family, input)) {
      return family;
    }
  }
  return null;
}

function mergeById<T extends { id: string }>(
  base: T[],
  additions: T[] | undefined,
): T[] {
  if (!additions?.length) return base;
  const merged = new Map(base.map((item) => [item.id, item]));
  for (const item of additions) {
    merged.set(item.id, { ...merged.get(item.id), ...item });
  }
  return [...merged.values()];
}

function mergeEstablishedFacts(
  base: CanonicalEstablishedFactSource[],
  additions: CanonicalEstablishedFactSource[] | undefined,
): CanonicalEstablishedFactSource[] {
  if (!additions?.length) return base;
  const merged = new Map(base.map((item) => [item.factId, { ...item }]));

  for (const addition of additions) {
    const existing = merged.get(addition.factId);
    if (!existing) {
      merged.set(addition.factId, { ...addition });
      continue;
    }
    merged.set(addition.factId, {
      ...existing,
      ...addition,
      fromComponents: [
        ...new Set([...(existing.fromComponents || []), ...(addition.fromComponents || [])]),
      ],
      fromBranches: [
        ...new Set([...(existing.fromBranches || []), ...(addition.fromBranches || [])]),
      ],
    });
  }

  return [...merged.values()];
}

function relationshipKey(rel: CanonicalRelationship): string {
  return `${rel.from}:${rel.type}:${rel.to}`;
}

function mergeRelationships(
  base: CanonicalRelationship[],
  additions: CanonicalRelationship[] | undefined,
): CanonicalRelationship[] {
  if (!additions?.length) return base;
  const merged = new Map(base.map((item) => [relationshipKey(item), item]));
  for (const item of additions) {
    merged.set(relationshipKey(item), item);
  }
  return [...merged.values()];
}

function mergeFunctionalDependencies(
  base: CanonicalDependency[],
  additions: CanonicalDependency[] | undefined,
): CanonicalDependency[] {
  return mergeById(base, additions);
}

function applyAdditions(
  graph: CanonicalOntology,
  additions: ManufacturerGraphAdditions | undefined,
  trace: ResolutionTraceEntry[],
  layerId: string,
): void {
  if (!additions) return;

  if (additions.components?.length) {
    graph.components = mergeById(graph.components, additions.components);
    trace.push({ layer: 'manufacturer', id: layerId, action: 'add_components', detail: String(additions.components.length) });
  }
  if (additions.relationships?.length) {
    graph.relationships = mergeRelationships(graph.relationships, additions.relationships);
    trace.push({ layer: 'manufacturer', id: layerId, action: 'add_relationships', detail: String(additions.relationships.length) });
  }
  if (additions.functionalDependencies?.length) {
    graph.functionalDependencies = mergeFunctionalDependencies(
      graph.functionalDependencies,
      additions.functionalDependencies,
    );
    trace.push({ layer: 'manufacturer', id: layerId, action: 'add_dependencies', detail: String(additions.functionalDependencies.length) });
  }
  if (additions.establishedFactSources?.length) {
    graph.establishedFactSources = mergeEstablishedFacts(
      graph.establishedFactSources || [],
      additions.establishedFactSources,
    );
    trace.push({ layer: 'manufacturer', id: layerId, action: 'merge_facts', detail: String(additions.establishedFactSources.length) });
  }
  if (additions.testTargets?.length) {
    graph.testTargets = mergeById(graph.testTargets || [], additions.testTargets);
    trace.push({ layer: 'manufacturer', id: layerId, action: 'add_test_targets', detail: String(additions.testTargets.length) });
  }
  if (additions.failureDomains?.length) {
    graph.failureDomains = mergeById(graph.failureDomains, additions.failureDomains);
  }
  if (additions.diagnosticEntryPoints?.length) {
    graph.diagnosticEntryPoints = mergeById(
      graph.diagnosticEntryPoints,
      additions.diagnosticEntryPoints,
    );
  }
}

function applyOverrides(
  graph: CanonicalOntology,
  overrides: GraphOverride[] | undefined,
  trace: ResolutionTraceEntry[],
  layerId: string,
): void {
  if (!overrides?.length) return;

  for (const override of overrides) {
    if (override.layer === 'relationship') {
      if (override.action === 'remove') {
        graph.relationships = graph.relationships.filter((rel) => {
          const match = override.match;
          if (match.from && rel.from !== match.from) return true;
          if (match.to && rel.to !== match.to) return true;
          if (match.type && rel.type !== match.type) return true;
          return false;
        });
        trace.push({
          layer: 'manufacturer',
          id: layerId,
          action: 'remove_relationship',
          detail: override.reason || JSON.stringify(override.match),
        });
      }
      if (override.action === 'replace' && override.value) {
        const replacement = override.value as unknown as CanonicalRelationship;
        graph.relationships = graph.relationships.filter((rel) =>
          relationshipKey(rel) !== relationshipKey(replacement),
        );
        graph.relationships.push(replacement);
        trace.push({ layer: 'manufacturer', id: layerId, action: 'replace_relationship' });
      }
    }

    if (override.layer === 'functionalDependency' && override.action === 'merge') {
      const dependencyId = override.match.id;
      if (!dependencyId) continue;
      graph.functionalDependencies = graph.functionalDependencies.map((dep) => {
        if (dep.id !== dependencyId) return dep;
        const value = override.value || {};
        return {
          ...dep,
          requires: value.requires
            ? [...new Set([...(dep.requires || []), ...(value.requires as string[])])]
            : dep.requires,
          conditional: value.conditional
            ? [...new Set([...(dep.conditional || []), ...(value.conditional as string[])])]
            : dep.conditional,
          feedback: value.feedback
            ? [...new Set([...(dep.feedback || []), ...(value.feedback as string[])])]
            : dep.feedback,
        };
      });
      trace.push({
        layer: 'manufacturer',
        id: layerId,
        action: 'merge_dependency',
        detail: dependencyId,
      });
    }

    if (override.layer === 'functionalDependency' && override.action === 'remove') {
      const dependencyId = override.match.id;
      graph.functionalDependencies = graph.functionalDependencies.filter(
        (dep) => dep.id !== dependencyId,
      );
      trace.push({ layer: 'manufacturer', id: layerId, action: 'remove_dependency', detail: dependencyId });
    }
  }
}

function applyModelOverlay(
  graph: CanonicalOntology,
  modelOverlay: ModelOverlayFile | null | undefined,
  trace: ResolutionTraceEntry[],
): void {
  if (!modelOverlay) return;
  applyAdditions(graph, modelOverlay.add, trace, modelOverlay.modelPattern);
  applyOverrides(graph, modelOverlay.overrides, trace, modelOverlay.modelPattern);
}

export function resolveDiagnosticGraph(
  input: ResolveDiagnosticGraphInput,
  modelOverlay: ModelOverlayFile | null = null,
): ResolvedDiagnosticGraph | null {
  const canonical = getCanonicalOntologyForTemplate(input.templateId, input.platformId);
  if (!canonical) return null;

  const graph = cloneOntology(canonical);
  const trace: ResolutionTraceEntry[] = [
    { layer: 'canonical', id: canonical.ontology.id, action: 'load' },
  ];
  const layers = ['canonical'];

  let manufacturer: string | null = null;
  let platformFamilyId: string | null = null;
  let platformId: string | null = input.platformId || null;
  const oemTermAliases: Record<string, string> = {};
  const displayTerms: Record<string, string> = {};
  let procedureBindings: ResolvedDiagnosticGraph['procedureBindings'] = [];
  let measurementBindings: ResolvedDiagnosticGraph['measurementBindings'] = [];

  const overlayFiles = MANUFACTURER_OVERLAYS_BY_ONTOLOGY[canonical.ontology.id] || [];
  for (const overlayFile of overlayFiles) {
    const family = selectPlatformFamilyOverlay(overlayFile, input);
    if (!family) continue;

    manufacturer = overlayFile.manufacturer;
    platformFamilyId = family.platformFamilyId;
    platformId = family.platformId;
    layers.push(`manufacturer:${overlayFile.manufacturer}`);
    layers.push(`platform:${family.platformFamilyId}`);

    Object.assign(oemTermAliases, family.oemTermAliases || {});
    Object.assign(displayTerms, family.displayTerms || {});

    applyAdditions(graph, family.add, trace, family.platformFamilyId);
    applyOverrides(graph, family.overrides, trace, family.platformFamilyId);

    procedureBindings = [...procedureBindings, ...(family.procedureBindings || [])];
    measurementBindings = [...measurementBindings, ...(family.measurementBindings || [])];
  }

  applyModelOverlay(graph, modelOverlay, trace);
  if (modelOverlay) {
    layers.push(`model:${modelOverlay.modelPattern}`);
    procedureBindings = [...procedureBindings, ...(modelOverlay.procedureBindings || [])];
    measurementBindings = [...measurementBindings, ...(modelOverlay.measurementBindings || [])];
  }

  return {
    ...graph,
    resolution: {
      canonicalOntologyId: canonical.ontology.id,
      manufacturer,
      platformFamilyId,
      platformId,
      model: input.model || null,
      layers,
      trace,
    },
    oemTermAliases,
    displayTerms,
    procedureBindings,
    measurementBindings,
  };
}

export function getManufacturerOverlaysForOntology(
  ontologyId: string,
): ManufacturerOverlayFile[] {
  return MANUFACTURER_OVERLAYS_BY_ONTOLOGY[ontologyId] || [];
}

export function resolveDiagnosticGraphForSession(
  session: {
    payload: { templateId: string };
    appliance: { manufacturer: string | null; model: string | null; platform: string | null };
  },
): ResolvedDiagnosticGraph | null {
  return resolveDiagnosticGraph({
    templateId: session.payload.templateId,
    manufacturer: session.appliance.manufacturer,
    model: session.appliance.model,
    platformId: session.appliance.platform,
  });
}
