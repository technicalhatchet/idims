/**

 * CG-1 ontology contract — three layers stay separate:

 * 1. PHYSICAL TOPOLOGY — relationships (what is connected to what)

 * 2. DIAGNOSTIC TOPOLOGY — functionalDependencies, established facts, testTargets

 * 3. PROCEDURAL KNOWLEDGE — OEM procedure seeds (not in this file)

 */



export type CanonicalKnowledgeSource =

  | 'canonical'

  | 'service_manual'

  | 'observed'

  | 'technician_confirmed';



export type CanonicalConfidence = 'high' | 'medium' | 'low';



export type CanonicalRelationshipType =

  | 'supplies'

  | 'controls'

  | 'commands'

  | 'provides_feedback_to'

  | 'communicates_with'

  | 'senses'

  | 'mechanically_drives'

  | 'mechanically_connected_to'

  | 'hydraulically_connects_to'

  | 'depends_on'

  | 'enables'

  | 'inhibits'

  | 'reports_level_through'

  | 'monitors'

  | 'thermally_connected_to'

  | 'protected_by'

  | 'protects'

  | 'routed_through'

  | 'implements'

  | 'hydraulically_connected_to';



export type CanonicalTestTargetRole = 'prerequisite' | 'discriminator' | 'verification';



export interface CanonicalSystem {

  id: string;

  name: string;

  categoryId?: string;

  purpose?: string;

  optional?: boolean;

}



export interface CanonicalComponent {

  id: string;

  name?: string;

  systemId?: string;

  categoryId?: string | null;

  type?: string;

  aliases?: string[];

  optional?: boolean;

  pendingEvidenceGraph?: boolean;

  comboVariantOnly?: boolean;

}



/** Physical / functional wiring — not diagnostic prerequisites. */

export interface CanonicalRelationship {

  from: string;

  to: string;

  type: CanonicalRelationshipType;

  source?: CanonicalKnowledgeSource;

  confidence?: CanonicalConfidence;

  note?: string;

}



/** Diagnostic topology — what must be true before a function can work. */

export interface CanonicalDependency {

  id: string;

  description?: string;

  requires: string[];

  feedback?: string[];

  conditional?: string[];

  enables?: string[];

  source?: CanonicalKnowledgeSource;

  confidence?: CanonicalConfidence;

}



export interface CanonicalEstablishedFactSource {

  factId: string;

  label?: string;

  /** Component verified_good (eliminated) establishes this fact. */

  fromComponents?: string[];

  /** Resolved procedure branch ids establish this fact. */

  fromBranches?: string[];

  source?: CanonicalKnowledgeSource;

  confidence?: CanonicalConfidence;

}



export interface CanonicalTestTargetRequirements {

  facts?: string[];

  dependencies?: string[];

}



/** Abstract diagnostic test — maps to procedure seeds via testAliasId. */

export interface CanonicalTestTarget {

  id: string;

  label?: string;

  role: CanonicalTestTargetRole;

  testAliasId: string;

  establishesFacts?: string[];

  requires?: CanonicalTestTargetRequirements;

  forGoals?: string[];

  source?: CanonicalKnowledgeSource;

  confidence?: CanonicalConfidence;

}



export interface CanonicalDiagnosticEntryPoint {

  id: string;

  symptoms: string[];

  initialDomains: string[];

  /** Functional dependency ids activated for this complaint path. */

  activeGoals?: string[];

}



export interface CanonicalFailureDomain {

  id: string;

  label?: string;

  components?: string[];

  optional?: boolean;

  crossCutting?: boolean;

}



export interface CanonicalOntologyMeta {

  id: string;

  name: string;

  templateId: string;

  variant: string;

  description?: string;

  frozen?: boolean;

  frozenAt?: string;

  frozenRevision?: string;

  frozenNote?: string;

}



export interface CanonicalOntology {

  schemaVersion: string;

  ontology: CanonicalOntologyMeta;

  designPrinciples?: string[];

  relationshipTypes?: CanonicalRelationshipType[];

  systems: CanonicalSystem[];

  components: CanonicalComponent[];

  relationships: CanonicalRelationship[];

  functionalDependencies: CanonicalDependency[];

  establishedFactSources?: CanonicalEstablishedFactSource[];

  testTargets?: CanonicalTestTarget[];

  failureDomains: CanonicalFailureDomain[];

  diagnosticEntryPoints: CanonicalDiagnosticEntryPoint[];

  diagnosticPrinciples?: Record<string, unknown>;

  componentStateModel?: Record<string, unknown>;

}



export interface PlatformProcedureOverlayEntry {

  procedureId: string;

  seedProcedureId?: string;

  canonicalComponents?: string[];

  failureDomains?: string[];

  mappingNote?: string;

}



export interface PlatformCanonicalOverlay {

  platformId: string;

  manualId?: string;

  smokeModel?: string;

  label?: string;

  componentAliases?: Record<string, string>;

  procedures?: PlatformProcedureOverlayEntry[];

  gaps?: Array<{ canonicalComponent: string; confidence: string; note?: string }>;

}



export interface CanonicalPlatformOverlayFile {

  canonicalOntologyId: string;

  platforms: PlatformCanonicalOverlay[];

}



export interface CanonicalEntryPointMatch {

  entryPointId: string;

  matchedBy: Array<'chip' | 'error_code' | 'text'>;

  matchDetail: string;

  initialDomains: string[];

}



export interface CanonicalRoutingResult {

  ontologyId: string;

  ontologyLabel: string;

  matchedEntryPoints: CanonicalEntryPointMatch[];

  activeDomains: string[];

  domainLabels: Record<string, string>;

  suggestedComponents: string[];

  overlayPlatformId: string | null;

  overlayProcedureCount: number;

  unmappedProcedureCount: number;

}



/** Runtime evaluation — CG-1 graph state snapshot. */

export type CanonicalFactState = 'unknown' | 'established' | 'contradicted';



export interface CanonicalGraphFactStatus {

  factId: string;

  label: string;

  state: CanonicalFactState;

  sources: string[];

}



export interface CanonicalGraphDependencyStatus {

  dependencyId: string;

  satisfied: boolean;

  unknownRequired: string[];

  failedRequired: string[];

}



export interface CanonicalGraphState {

  ontologyId: string;

  activeGoals: string[];

  activeDomains: string[];

  facts: CanonicalGraphFactStatus[];

  dependencies: CanonicalGraphDependencyStatus[];

  establishedFactIds: Set<string>;

  /** CG-2: which overlay layers contributed to this evaluation. */
  resolutionLayers?: string[];

}



/** CG-2 overlay contract — additive enrichment, explicit overrides only. */

export type GraphOverrideLayer =
  | 'relationship'
  | 'functionalDependency'
  | 'testTarget'
  | 'establishedFactSource'
  | 'failureDomain'
  | 'diagnosticEntryPoint';

export type GraphOverrideAction = 'remove' | 'replace' | 'merge';

export interface GraphOverride {
  layer: GraphOverrideLayer;
  action: GraphOverrideAction;
  match: Partial<Record<string, string>>;
  value?: Record<string, unknown>;
  reason?: string;
  source?: CanonicalKnowledgeSource;
}

export interface OverlayAppliesTo {
  templateId?: string;
  manufacturers?: string[];
  modelPatterns?: string[];
  platformIds?: string[];
}

export interface ManufacturerGraphAdditions {
  components?: CanonicalComponent[];
  relationships?: CanonicalRelationship[];
  functionalDependencies?: CanonicalDependency[];
  establishedFactSources?: CanonicalEstablishedFactSource[];
  testTargets?: CanonicalTestTarget[];
  failureDomains?: CanonicalFailureDomain[];
  diagnosticEntryPoints?: CanonicalDiagnosticEntryPoint[];
}

export interface ProcedureTestBinding {
  procedureId: string;
  testTargetId: string;
  establishesFacts?: string[];
  failureDomains?: string[];
  displayTitle?: string;
  oemTestNumber?: string;
  canonicalComponents?: string[];
  implementationComponent?: string;
  platformNote?: string;
}

export interface MeasurementSpecBinding {
  procedureId: string;
  measurementKnowledgeId: string;
  testTargetId?: string;
  establishesFacts?: string[];
  displayLabel?: string;
  units?: string;
  abnormalStatuses?: Array<'critical' | 'warning'>;
}

export interface PlatformFamilyOverlay {
  platformFamilyId: string;
  platformId: string;
  manualId?: string;
  label?: string;
  appliesTo: OverlayAppliesTo;
  oemTermAliases?: Record<string, string>;
  displayTerms?: Record<string, string>;
  add?: ManufacturerGraphAdditions;
  overrides?: GraphOverride[];
  procedureBindings?: ProcedureTestBinding[];
  measurementBindings?: MeasurementSpecBinding[];
}

export interface ManufacturerOverlayFile {
  schemaVersion: string;
  overlayKind: 'manufacturer';
  canonicalOntologyId: string;
  manufacturer: string;
  label?: string;
  platformFamilies: PlatformFamilyOverlay[];
}

export interface ModelOverlayFile {
  schemaVersion: string;
  overlayKind: 'model';
  canonicalOntologyId: string;
  platformFamilyId: string;
  modelPattern: string;
  label?: string;
  add?: ManufacturerGraphAdditions;
  overrides?: GraphOverride[];
  procedureBindings?: ProcedureTestBinding[];
  measurementBindings?: MeasurementSpecBinding[];
}

export interface ResolutionTraceEntry {
  layer: 'canonical' | 'manufacturer' | 'platform' | 'model';
  id: string;
  action: string;
  detail?: string;
}

export interface ResolvedDiagnosticGraph extends CanonicalOntology {
  resolution: {
    canonicalOntologyId: string;
    manufacturer: string | null;
    platformFamilyId: string | null;
    platformId: string | null;
    model: string | null;
    layers: string[];
    trace: ResolutionTraceEntry[];
  };
  oemTermAliases: Record<string, string>;
  displayTerms: Record<string, string>;
  procedureBindings: ProcedureTestBinding[];
  measurementBindings: MeasurementSpecBinding[];
}

export interface ResolveDiagnosticGraphInput {
  templateId: string;
  manufacturer?: string | null;
  model?: string | null;
  platformId?: string | null;
}


