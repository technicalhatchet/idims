export const REVIEW_DECISIONS_API = '/api/knowledge/normalization/review/decisions';

export const REVIEW_CLASS_LABELS = {
  inheritedKnowledge: 'Inherited knowledge',
  existingCanonicalMapping: 'Existing canonical mapping',
  newPlatformKnowledge: 'New platform knowledge',
  newCanonicalKnowledge: 'Possible new canonical abstraction',
  implementationSpecific: 'Implementation specific',
  unresolved: 'Unresolved',
  architectureException: 'Architecture exception',
};

export const EXISTING_CANONICAL_MAPPING_NOTICE =
  'This candidate maps to an existing frozen canonical function. Review acceptance does not modify or promote the canonical ontology.';

export const NEW_CANONICAL_KNOWLEDGE_NOTICE =
  'Possible new canonical abstraction — architecture gate required. Review acceptance does not approve ontology changes or promotion.';

/**
 * Merge persisted review decisions into index records without mutating classification or candidate data.
 */
export function mergeHydratedDecisions(records, decisionsStore) {
  const decisionMap = decisionsStore?.decisions || {};
  return records.map((record) => {
    const decision = decisionMap[record.candidateId] || {};
    const reviewStatus = decision.reviewStatus || record.reviewStatus || 'unreviewed';
    return {
      ...record,
      reviewStatus,
      reviewDecision: {
        reviewStatus,
        reviewer: decision.reviewer || record.reviewDecision?.reviewer || null,
        reason: decision.reason || record.reviewDecision?.reason || null,
        updatedAt: decision.updatedAt || record.reviewDecision?.updatedAt || null,
      },
    };
  });
}

/**
 * Build decisionState map from API store for list filtering and display.
 */
export function decisionsMapFromStore(decisionsStore) {
  const map = {};
  const entries = decisionsStore?.decisions || {};
  for (const [candidateId, decision] of Object.entries(entries)) {
    if (decision?.reviewStatus) {
      map[candidateId] = decision.reviewStatus;
    }
  }
  return map;
}

/**
 * Format Where / Provenance detail text from existing index record fields only.
 */
export function formatWhereProvenance(record) {
  if (!record) return '—';

  const where = record.where || {};
  const context = record.context || {};
  const lines = [];

  const manualId = record.manualId || record.what?.manualId;
  if (manualId) lines.push(`manualId: ${manualId}`);

  const procedureId = record.what?.procedureId;
  if (procedureId) lines.push(`procedureId: ${procedureId}`);

  if (where.extractionDoc) lines.push(`extractionDoc: ${where.extractionDoc}`);

  const pages = where.pages;
  if (Array.isArray(pages) && pages.length > 0) {
    lines.push(`pages: ${pages.join(', ')}`);
  }

  if (context.inheritedFromManualId) {
    lines.push(`inheritedFromManualId: ${context.inheritedFromManualId}`);
  }
  if (context.seedSourceManualId) {
    lines.push(`seedSourceManualId: ${context.seedSourceManualId}`);
  }
  if (context.platformId) {
    lines.push(`platformId: ${context.platformId}`);
  }

  const sources = where.provenanceSources;
  if (Array.isArray(sources) && sources.length > 0) {
    lines.push(`provenanceSources: ${JSON.stringify(sources, null, 2)}`);
  }

  return lines.length > 0 ? lines.join('\n') : '—';
}
