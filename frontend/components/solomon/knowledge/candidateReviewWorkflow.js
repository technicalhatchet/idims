export const REVIEW_DECISIONS_API = '/api/knowledge/normalization/review/decisions';
export const MATCHER_IMPROVEMENT_DECISIONS_API =
  '/api/knowledge/normalization/review/matcher-improvement-decisions';
export const DELTA_RECONCILIATION_DECISIONS_API =
  '/api/knowledge/normalization/review/delta-reconciliation-decisions';
export const MATCHER_RECONCILED_CANDIDATE_REVIEW_DECISIONS_API =
  '/api/knowledge/normalization/review/matcher-reconciled-candidate-review-decisions';

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

export const REVIEW_QUESTION_SOURCE = 'What term is in the manual?';
export const REVIEW_QUESTION_MAPS_TO = 'What does it map to?';
export const REVIEW_QUESTION_WHERE = 'Where did it come from?';
export const REVIEW_QUESTION_WHY = 'Why did the system produce it?';
export const REVIEW_QUESTION_BLOCKERS = 'Blockers & reconciliation';

/** Accordion section titles (logical groups in review detail). */
export const REVIEW_SECTION_WHAT = 'WHAT';
export const REVIEW_SECTION_MAPS_TO = 'MAPS TO';
export const REVIEW_SECTION_WHERE = 'WHERE / PROVENANCE';
export const REVIEW_SECTION_WHY = 'WHY';
export const REVIEW_SECTION_BLOCKERS = 'Blockers';
export const REVIEW_SECTION_CONTEXT = 'Context';
export const REVIEW_SECTION_RECONCILIATION = 'Reconciliation';

export const REVIEW_SECTION_NUMBERED_LABELS = {
  what: `1. ${REVIEW_SECTION_WHAT}`,
  mapsTo: `2. ${REVIEW_SECTION_MAPS_TO}`,
  where: `3. ${REVIEW_SECTION_WHERE}`,
  why: `4. ${REVIEW_SECTION_WHY}`,
  blockers: `5. ${REVIEW_SECTION_BLOCKERS}`,
  context: `6. ${REVIEW_SECTION_CONTEXT}`,
  reconciliation: `7. ${REVIEW_SECTION_RECONCILIATION}`,
};

// --- Presentation-only section previews (same fields as each accordion body) ---

/**
 * @typedef {{ label: string, value: string, emphasize?: boolean }} ReviewPreviewLine
 * @typedef {{ primary: string, secondaryLines: ReviewPreviewLine[] }} ReviewSectionPreview
 */

export function emptyPreview() {
  return { primary: '—', secondaryLines: [] };
}

export function pushPreviewLine(lines, label, value, emphasize = false) {
  if (value === null || value === undefined || value === '') return;
  lines.push({ label, value: String(value), emphasize });
}

function basenameFromPath(path) {
  if (!path) return null;
  const normalized = String(path).replace(/\\/g, '/');
  const base = normalized.split('/').pop();
  return base || normalized;
}

export function extractionDocFileName(record) {
  return basenameFromPath(record?.where?.extractionDoc);
}

/** Dominant WHERE line: extraction doc filename, then provenance `extraction_doc` path. */
export function wherePrimaryDocument(record) {
  const fromField = extractionDocFileName(record);
  if (fromField) return fromField;
  const sources = record?.where?.provenanceSources;
  if (!Array.isArray(sources)) return null;
  for (const source of sources) {
    if (source?.type === 'extraction_doc' && source?.path) {
      const base = basenameFromPath(source.path);
      if (base) return base;
    }
  }
  return null;
}

/** @returns {ReviewSectionPreview} */
export function whatSectionPreview(record) {
  if (!record) return emptyPreview();
  const manualId = record.what?.manualId || record.manualId || '—';
  const procedureId = record.what?.procedureId;
  const sourceTerm = record.what?.sourceTerm;
  const secondaryLines = [
    {
      label: 'procedureId:',
      value: procedureId ? String(procedureId) : '—',
    },
    {
      label: 'sourceTerm:',
      value: sourceTerm ? String(sourceTerm) : '—',
    },
  ];
  return { primary: manualId, secondaryLines };
}

/** @returns {ReviewSectionPreview} */
export function mapsToSectionPreview(record) {
  if (!record) return emptyPreview();
  const canonical = record.mapsTo?.proposedCanonicalId || '—';
  const secondaryLines = [];
  pushPreviewLine(secondaryLines, 'mappingType:', record.mapsTo?.mappingType);
  pushPreviewLine(secondaryLines, 'candidateType:', record.mapsTo?.candidateType);
  return { primary: canonical, secondaryLines };
}

/** @returns {ReviewSectionPreview} */
export function whereSectionPreview(record) {
  if (!record) return emptyPreview();
  const where = record.where || {};
  const context = record.context || {};
  const docName = wherePrimaryDocument(record);
  const primary = docName || '—';
  const secondaryLines = [];
  const pages = where.pages;
  if (Array.isArray(pages) && pages.length > 0) {
    pushPreviewLine(secondaryLines, 'pages:', pages.join(', '));
  }
  pushPreviewLine(secondaryLines, 'platformId:', context.platformId);
  if (!docName) {
    pushPreviewLine(secondaryLines, 'manualId:', record.manualId || record.what?.manualId);
  }
  return { primary, secondaryLines };
}

/** @returns {ReviewSectionPreview} */
export function whySectionPreview(record) {
  if (!record) return emptyPreview();
  const why = record.why || {};
  const secondaryLines = [];
  if (typeof why.confidence === 'number') {
    pushPreviewLine(secondaryLines, 'confidence:', why.confidence, true);
  } else if (why.reason) {
    pushPreviewLine(secondaryLines, 'reason:', why.reason, true);
  }
  pushPreviewLine(secondaryLines, 'candidateStatus:', why.candidateStatus);
  if (typeof why.confidence === 'number' && why.reason) {
    pushPreviewLine(secondaryLines, 'reason:', why.reason);
  }
  pushPreviewLine(secondaryLines, 'matchedPhrase:', why.matchedPhrase);
  pushPreviewLine(secondaryLines, 'blockedReason:', why.blockedReason);
  if (secondaryLines.length === 0) {
    const fallback = why.candidateStatus ? String(why.candidateStatus) : '—';
    return { primary: fallback, secondaryLines: [] };
  }
  return { primary: '', secondaryLines };
}

/** @returns {ReviewSectionPreview} */
export function blockersSectionPreview(record) {
  if (!record?.blockers) return emptyPreview();
  const blockers = record.blockers;
  const secondaryLines = [];
  if (blockers.blockedReason) {
    if (blockers.promotionBlocked === true) {
      pushPreviewLine(secondaryLines, 'promotionBlocked:', 'true');
    }
    if (Array.isArray(blockers.conflicts) && blockers.conflicts.length > 0) {
      pushPreviewLine(secondaryLines, 'conflicts:', String(blockers.conflicts.length));
    }
    return { primary: String(blockers.blockedReason), secondaryLines };
  }
  if (blockers.promotionBlocked === true) {
    if (Array.isArray(blockers.conflicts) && blockers.conflicts.length > 0) {
      pushPreviewLine(secondaryLines, 'conflicts:', String(blockers.conflicts.length));
    }
    return { primary: 'true', secondaryLines };
  }
  if (Array.isArray(blockers.conflicts) && blockers.conflicts.length > 0) {
    return { primary: String(blockers.conflicts.length), secondaryLines: [] };
  }
  return emptyPreview();
}

/** @returns {ReviewSectionPreview} */
export function contextSectionPreview(record) {
  if (!record?.context) return emptyPreview();
  const context = record.context;
  const primary = context.platformId || '—';
  const secondaryLines = [];
  pushPreviewLine(secondaryLines, 'inheritedFromManualId:', context.inheritedFromManualId);
  pushPreviewLine(secondaryLines, 'seedSourceManualId:', context.seedSourceManualId);
  return { primary, secondaryLines };
}

/** @returns {ReviewSectionPreview} */
export function reconciliationSectionPreview(reconciliation) {
  if (!reconciliation) return emptyPreview();
  const primary = reconciliation.manualId || '—';
  const secondaryLines = [];
  pushPreviewLine(secondaryLines, 'useForReview:', reconciliation.useForReview);
  return { primary, secondaryLines };
}

function previewToOneLine(preview) {
  if (!preview) return '—';
  const parts = [];
  if (preview.primary && preview.primary !== '—') parts.push(preview.primary);
  for (const line of preview.secondaryLines || []) {
    parts.push(`${line.label} ${line.value}`);
  }
  return parts.length > 0 ? parts.join(' · ') : '—';
}

/** List-row helper: bold canonical id + muted mapping meta */
export function mapsToCollapsedParts(record) {
  const preview = mapsToSectionPreview(record);
  const highlight =
    preview.secondaryLines.find((line) => line.emphasize)?.value
    || preview.primary
    || '—';
  const detail = preview.secondaryLines
    .filter((line) => !line.emphasize)
    .map((line) => line.value)
    .filter(Boolean)
    .join(' · ');
  return { highlight, detail };
}

export const whatCollapsedParts = whatSectionPreview;
export const whereCollapsedParts = whereSectionPreview;
export const whyCollapsedParts = whySectionPreview;
export const blockersCollapsedParts = blockersSectionPreview;
export const contextCollapsedParts = contextSectionPreview;
export const reconciliationCollapsedParts = reconciliationSectionPreview;

/**
 * Collapsed header: proposed canonical id first, then mapping type (mapsTo fields only).
 */
export function formatMapsToSummary(record) {
  return previewToOneLine(mapsToSectionPreview(record));
}

export function formatWhereSummary(record) {
  return previewToOneLine(whereSectionPreview(record));
}

/**
 * Collapsed preview from `why` only — reason / match phrase first, then confidence and status.
 */
export function formatWhySummary(record) {
  if (!record) return '—';
  const why = record.why || {};
  const parts = [];
  if (why.reason) parts.push(`reason: ${why.reason}`);
  if (why.matchedPhrase) parts.push(`matchedPhrase: ${why.matchedPhrase}`);
  if (typeof why.confidence === 'number') parts.push(`confidence: ${why.confidence}`);
  if (why.candidateStatus) parts.push(`candidateStatus: ${why.candidateStatus}`);
  if (why.blockedReason) parts.push(`blockedReason: ${why.blockedReason}`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export function formatSourceTermLabel(record) {
  if (!record) return '—';
  return record.what?.sourceTerm || record.candidateId || '—';
}

/**
 * Collapsed header: source term first, then manual / procedure (what fields only).
 */
export function formatWhatSummary(record) {
  return previewToOneLine(whatSectionPreview(record));
}

/**
 * One-line glance summary for blockers / promotion flags.
 */
export function formatCandidateSummary(record) {
  if (!record) return '—';
  const sourceTerm = formatSourceTermLabel(record);
  const reviewClass = record.reviewClass || record.context?.reviewClass;
  const classLabel = reviewClass ? (REVIEW_CLASS_LABELS[reviewClass] || reviewClass) : null;
  return classLabel ? `${sourceTerm} · ${classLabel}` : sourceTerm;
}

export function formatReconciliationSummary(reconciliation) {
  return previewToOneLine(reconciliationSectionPreview(reconciliation));
}

export function formatBlockersSummary(record) {
  return previewToOneLine(blockersSectionPreview(record));
}

export function formatContextSummary(record) {
  return previewToOneLine(contextSectionPreview(record));
}

/**
 * After a decision on `currentCandidateId`, select the next row in the visible list
 * (same order as the list UI). Falls back to the previous row at the end of the list.
 */
export function pickNextCandidateIdInList(orderedRecords, currentCandidateId) {
  if (!Array.isArray(orderedRecords) || orderedRecords.length === 0) return null;
  const idx = orderedRecords.findIndex((record) => record.candidateId === currentCandidateId);
  if (idx < 0) return orderedRecords[0]?.candidateId ?? null;
  if (idx + 1 < orderedRecords.length) return orderedRecords[idx + 1].candidateId;
  if (idx > 0) return orderedRecords[idx - 1].candidateId;
  return null;
}

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

  if (where.extractionDoc) {
    lines.push(`extractionDoc: ${where.extractionDoc}`);
  } else {
    const sources = where.provenanceSources;
    if (Array.isArray(sources)) {
      const docSource = sources.find((entry) => entry?.type === 'extraction_doc' && entry?.path);
      if (docSource?.path) lines.push(`extractionDoc: ${docSource.path}`);
    }
  }

  const pages = where.pages;
  if (Array.isArray(pages) && pages.length > 0) {
    lines.push(`pages: ${pages.join(', ')}`);
  }

  const sources = where.provenanceSources;
  if (Array.isArray(sources) && sources.length > 0) {
    lines.push(`provenanceSources: ${JSON.stringify(sources, null, 2)}`);
  }

  if (context.platformId) {
    lines.push(`platformId: ${context.platformId}`);
  }

  if (context.inheritedFromManualId) {
    lines.push(`inheritedFromManualId: ${context.inheritedFromManualId}`);
  }
  if (context.seedSourceManualId) {
    lines.push(`seedSourceManualId: ${context.seedSourceManualId}`);
  }

  const manualId = record.manualId || record.what?.manualId;
  if (manualId) lines.push(`manualId: ${manualId}`);

  const procedureId = record.what?.procedureId;
  if (procedureId) lines.push(`procedureId: ${procedureId}`);

  return lines.length > 0 ? lines.join('\n') : '—';
}
