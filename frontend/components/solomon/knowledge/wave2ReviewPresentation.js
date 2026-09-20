import { WAVE2_REVIEW_CLASS } from './wave2ReviewGuidance';
import {
  emptyPreview,
  pushPreviewLine,
  wherePrimaryDocument,
  whatSectionPreview,
  mapsToSectionPreview,
  whereSectionPreview,
  contextSectionPreview,
  whySectionPreview,
} from './candidateReviewWorkflow';

export { WAVE2_REVIEW_CLASS };

export function isNewPlatformKnowledgeCandidate(record) {
  return record?.reviewClass === WAVE2_REVIEW_CLASS;
}

/**
 * Measurement / test substance from existing provenance only (no synthesized fields).
 * @returns {import('./candidateReviewWorkflow').ReviewPreviewLine[]}
 */
export function wave2DiagnosticKnowledgeLines(record) {
  if (!record) return [];
  const lines = [];
  const sources = record.where?.provenanceSources;
  if (!Array.isArray(sources)) return lines;

  for (const source of sources) {
    if (source?.type !== 'measurement') continue;
    if (source.stepTitle) {
      pushPreviewLine(lines, 'step:', String(source.stepTitle), true);
    }
    if (source.measurementKnowledgeId) {
      pushPreviewLine(lines, 'measurementKnowledgeId:', String(source.measurementKnowledgeId), true);
    }
  }
  return lines;
}

/** @returns {import('./candidateReviewWorkflow').ReviewSectionPreview} */
export function wave2WhatSectionPreview(record) {
  if (!record) return emptyPreview();
  const procedureId = record.what?.procedureId;
  const manualId = record.what?.manualId || record.manualId;
  const sourceTerm = record.what?.sourceTerm;
  const secondaryLines = [
    {
      label: 'manualId:',
      value: manualId ? String(manualId) : '—',
      emphasize: true,
    },
    ...wave2DiagnosticKnowledgeLines(record),
    {
      label: 'sourceTerm:',
      value: sourceTerm ? String(sourceTerm) : '—',
      deemphasize: true,
    },
  ];
  return {
    primary: procedureId ? String(procedureId) : '—',
    secondaryLines,
  };
}

/** @returns {import('./candidateReviewWorkflow').ReviewSectionPreview} */
export function wave2MapsToSectionPreview(record) {
  if (!record) return emptyPreview();
  const canonical = record.mapsTo?.proposedCanonicalId || '—';
  const secondaryLines = [];
  pushPreviewLine(secondaryLines, 'candidateType:', record.mapsTo?.candidateType, true);
  pushPreviewLine(secondaryLines, 'mappingType:', record.mapsTo?.mappingType);
  return { primary: canonical, secondaryLines };
}

/** @returns {import('./candidateReviewWorkflow').ReviewSectionPreview} */
export function wave2WhereSectionPreview(record) {
  if (!record) return emptyPreview();
  const context = record.context || {};
  const docName = wherePrimaryDocument(record);
  const secondaryLines = [];
  const pages = record.where?.pages;
  if (Array.isArray(pages) && pages.length > 0) {
    pushPreviewLine(secondaryLines, 'pages:', pages.join(', '));
  }
  if (docName) {
    pushPreviewLine(secondaryLines, 'extractionDoc:', docName);
  }
  pushPreviewLine(secondaryLines, 'manualId:', record.manualId || record.what?.manualId);
  const platformId = context.platformId;
  return {
    primary: platformId ? String(platformId) : (docName || '—'),
    secondaryLines,
  };
}

/** @returns {import('./candidateReviewWorkflow').ReviewSectionPreview} */
export function wave2ContextSectionPreview(record) {
  if (!record?.context) return emptyPreview();
  const context = record.context;
  const primary = context.platformId || '—';
  const secondaryLines = [];
  pushPreviewLine(
    secondaryLines,
    'manualId:',
    record.what?.manualId || record.manualId,
    true,
  );
  pushPreviewLine(secondaryLines, 'inheritedFromManualId:', context.inheritedFromManualId);
  pushPreviewLine(secondaryLines, 'seedSourceManualId:', context.seedSourceManualId);
  return { primary, secondaryLines };
}

export function wave2ListRowPrimaryLabel(record) {
  if (!record) return '—';
  return record.what?.procedureId || record.candidateId || '—';
}

export function wave2ListRowMapsToHighlight(record) {
  return record.mapsTo?.proposedCanonicalId || '—';
}

export function wave2ListRowMapsToDetail(record) {
  const type = record.mapsTo?.candidateType;
  return type ? String(type) : '';
}

/**
 * Pick section preview builders for the detail accordion (Wave 2 hierarchy vs default).
 */
export function reviewSectionPreviewsForCandidate(record) {
  if (!isNewPlatformKnowledgeCandidate(record)) {
    return {
      what: whatSectionPreview(record),
      mapsTo: mapsToSectionPreview(record),
      where: whereSectionPreview(record),
      why: whySectionPreview(record),
      context: contextSectionPreview(record),
      wave2: false,
    };
  }
  return {
    what: wave2WhatSectionPreview(record),
    mapsTo: wave2MapsToSectionPreview(record),
    where: wave2WhereSectionPreview(record),
    why: whySectionPreview(record),
    context: wave2ContextSectionPreview(record),
    wave2: true,
  };
}
