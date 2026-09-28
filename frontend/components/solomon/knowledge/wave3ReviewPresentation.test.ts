import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mapsToSectionPreview, whatSectionPreview } from './candidateReviewWorkflow.js';
import {
  isNewCanonicalKnowledgeCandidate,
  reviewSectionPreviewsForCandidate,
  wave3BlockersSectionPreview,
} from './wave3ReviewPresentation.js';

const WAVE1_RECORD = {
  reviewClass: 'existingCanonicalMapping',
  what: { manualId: 'W8178558', procedureId: 'w8178558-door-lock', sourceTerm: 'door_lock' },
  mapsTo: { proposedCanonicalId: 'door_lock', candidateType: 'canonicalMapping' },
};

const WAVE3_RECORD = {
  reviewClass: 'newCanonicalKnowledge',
  what: { procedureId: 'proc-x', sourceTerm: '§8: Drain pump', manualId: 'TEST' },
  mapsTo: { proposedCanonicalId: 'novel_function', candidateType: 'canonicalDiscovery' },
  blockers: { promotionBlocked: true, conflicts: ['c1'] },
  where: { pages: [12] },
  context: { platformId: 'test_platform' },
};

test('Wave 1 previews unchanged when not Wave 3 or Wave 2 platform class', () => {
  const previews = reviewSectionPreviewsForCandidate(WAVE1_RECORD);
  assert.equal(previews.wave3, false);
  assert.deepEqual(previews.what, whatSectionPreview(WAVE1_RECORD));
});

test('Wave 3 previews prioritize procedure and maps-to with de-emphasized sourceTerm', () => {
  const previews = reviewSectionPreviewsForCandidate(WAVE3_RECORD);
  assert.equal(previews.wave3, true);
  assert.equal(previews.what.primary, 'proc-x');
  assert.equal(previews.mapsTo.primary, 'novel_function');
  const sourceLine = previews.what.secondaryLines.find((line) => line.label === 'sourceTerm:');
  assert.equal(sourceLine?.deemphasize, true);
});

test('Wave 3 blockers preview emphasizes conflicts', () => {
  const preview = wave3BlockersSectionPreview(WAVE3_RECORD);
  const conflicts = preview.secondaryLines.find((line) => line.label === 'conflicts:');
  assert.equal(conflicts?.emphasize, true);
  assert.equal(isNewCanonicalKnowledgeCandidate(WAVE3_RECORD), true);
});
