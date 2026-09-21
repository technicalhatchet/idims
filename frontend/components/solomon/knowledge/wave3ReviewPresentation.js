import { WAVE3_REVIEW_CLASS } from './wave3ReviewGuidance';
import {
  contextSectionPreview,
  mapsToSectionPreview,
  pushPreviewLine,
  reconciliationSectionPreview,
  whatSectionPreview,
  whereSectionPreview,
  whySectionPreview,
} from './candidateReviewWorkflow';
import {
  isNewPlatformKnowledgeCandidate,
  reviewSectionPreviewsForCandidate as wave2OnlySectionPreviews,
  wave2DiagnosticKnowledgeLines,
  wave2WhatSectionPreview,
  wave2MapsToSectionPreview,
  wave2WhereSectionPreview,
  wave2ContextSectionPreview,
} from './wave2ReviewPresentation';

export { WAVE3_REVIEW_CLASS };
export { isNewPlatformKnowledgeCandidate } from './wave2ReviewPresentation';

export function isNewCanonicalKnowledgeCandidate(record) {
  return record?.reviewClass === WAVE3_REVIEW_CLASS;
}

export function wave3WhatSectionPreview(record) {
  const base = wave2WhatSectionPreview(record);
  return base;
}

export function wave3MapsToSectionPreview(record) {
  const base = wave2MapsToSectionPreview(record);
  const proposed = record.mapsTo?.proposedCanonicalId;
  return {
    primary: proposed ? String(proposed) : base.primary,
    secondaryLines: base.secondaryLines,
  };
}

export function wave3WhereSectionPreview(record) {
  return wave2WhereSectionPreview(record);
}

export function wave3ContextSectionPreview(record) {
  return wave2ContextSectionPreview(record);
}

export function wave3BlockersSectionPreview(record) {
  if (!record?.blockers) {
    return { primary: '—', secondaryLines: [] };
  }
  const blockers = record.blockers;
  const secondaryLines = [];
  if (Array.isArray(blockers.conflicts) && blockers.conflicts.length > 0) {
    pushPreviewLine(
      secondaryLines,
      'conflicts:',
      String(blockers.conflicts.length),
      true,
    );
  }
  if (blockers.promotionBlocked === true) {
    pushPreviewLine(secondaryLines, 'promotionBlocked:', 'true', true);
  }
  if (blockers.blockedReason) {
    pushPreviewLine(secondaryLines, 'blockedReason:', String(blockers.blockedReason), true);
  }
  const primary = blockers.blockedReason
    ? String(blockers.blockedReason)
    : (blockers.promotionBlocked === true ? 'promotionBlocked' : '—');
  return { primary, secondaryLines };
}

export function wave3ReconciliationSectionPreview(reconciliation) {
  const base = reconciliationSectionPreview(reconciliation);
  if (!reconciliation) return base;
  const secondaryLines = [...(base.secondaryLines || [])];
  pushPreviewLine(secondaryLines, 'useForReview:', reconciliation.useForReview, true);
  return {
    primary: base.primary,
    secondaryLines,
  };
}

export function wave3ListRowPrimaryLabel(record) {
  return record?.what?.procedureId || record?.candidateId || '—';
}

export function wave3ListRowMapsToHighlight(record) {
  return record?.mapsTo?.proposedCanonicalId || '—';
}

export function wave3ListRowMapsToDetail(record) {
  const type = record?.mapsTo?.candidateType;
  return type ? String(type) : '';
}

export function reviewSectionPreviewsForCandidate(record) {
  if (isNewCanonicalKnowledgeCandidate(record)) {
    return {
      what: wave3WhatSectionPreview(record),
      mapsTo: wave3MapsToSectionPreview(record),
      where: wave3WhereSectionPreview(record),
      why: whySectionPreview(record),
      context: wave3ContextSectionPreview(record),
      blockers: wave3BlockersSectionPreview(record),
      wave3: true,
    };
  }
  if (isNewPlatformKnowledgeCandidate(record)) {
    const wave2 = wave2OnlySectionPreviews(record);
    return { ...wave2, wave3: false };
  }
  return {
    what: whatSectionPreview(record),
    mapsTo: mapsToSectionPreview(record),
    where: whereSectionPreview(record),
    why: whySectionPreview(record),
    context: contextSectionPreview(record),
    blockers: null,
    wave2: false,
    wave3: false,
  };
}

export { wave2DiagnosticKnowledgeLines as wave3DiagnosticKnowledgeLines };
