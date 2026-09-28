/** CG-3 — normalization candidate types (staging layer; not production overlays). */

export type NormalizationCandidateStatus =
  | 'candidate'
  | 'validated'
  | 'approved'
  | 'rejected'
  | 'UNRESOLVED_TERM'
  | 'CONFLICT_REQUIRES_REVIEW';

export type NormalizationConflictType =
  | 'ALIAS_CONFLICT'
  | 'RELATIONSHIP_CONFLICT'
  | 'TEST_TARGET_CONFLICT'
  | 'DUPLICATE_PROCEDURE';

export interface NormalizationProvenance {
  manualId: string;
  platformId?: string | null;
  procedureId?: string | null;
  pages?: number[];
  sources: Array<Record<string, unknown>>;
}

export interface NormalizedProcedure {
  procedureId: string;
  manufacturer: string;
  platformId: string;
  templateId?: string;
  title: string;
  purpose?: string;
  prerequisites: string[];
  componentIds: string[];
  tags: string[];
  steps: unknown[];
  measurements: unknown[];
  branches: unknown[];
  source: Record<string, unknown>;
  provenance: NormalizationProvenance;
}

export interface CanonicalMappingCandidate {
  id: string;
  status: NormalizationCandidateStatus;
  candidateType: 'canonicalMapping';
  sourceTerm: string;
  canonicalId: string | null;
  confidence: number;
  mappingType: 'alias' | 'component' | 'relationship';
  provenance: NormalizationProvenance;
}

export interface OverlayCandidate {
  id: string;
  status: NormalizationCandidateStatus;
  candidateType: 'procedureTestBinding' | 'measurementBinding';
  procedureId: string;
  canonicalTestTarget?: string;
  measurementKnowledgeId?: string;
  confidence: number;
  displayTitle?: string;
  provenance: NormalizationProvenance;
}

export interface NormalizationConflict {
  id: string;
  status: 'CONFLICT_REQUIRES_REVIEW';
  conflictType: NormalizationConflictType;
  description: string;
  assertions: unknown[];
}

export type ReviewApprovalLevel =
  | 'easy'
  | 'normal'
  | 'careful'
  | 'high_risk'
  | 'blocked';

export type ReviewLifecycleStatus =
  | 'candidate'
  | 'needs_review'
  | 'approved'
  | 'rejected'
  | 'promoted';

export interface CandidateReviewRecord {
  candidateId: string;
  candidateType: string;
  status: ReviewLifecycleStatus;
  approvalLevel: ReviewApprovalLevel;
  confidence?: number;
  what: string;
  mapsTo: string | null;
  why: Record<string, unknown>;
  source: Record<string, unknown>;
  conflicts: NormalizationConflict[];
  proposedChange: Record<string, unknown>;
  provenance: NormalizationProvenance;
  reviewHistory: Array<Record<string, unknown>>;
}

export interface PromotionPlan {
  promotionId: string;
  manualId: string;
  platformId?: string;
  overlayFile: string;
  platformFamilyId: string;
  status: 'planned' | 'published' | 'blocked';
  blocked: boolean;
  blockReasons: string[];
  approvedCandidateIds: string[];
  diff: Record<string, unknown>;
}

export interface NormalizationPipelineManifest {
  manualId: string;
  platformId?: string;
  templateId?: string;
  status: NormalizationCandidateStatus;
  ontologyId?: string | null;
  generatedAt: string;
  topologySignature?: string;
  counts: {
    procedures: number;
    mappingCandidates: number;
    overlayCandidates: number;
    conflicts: number;
  };
}
