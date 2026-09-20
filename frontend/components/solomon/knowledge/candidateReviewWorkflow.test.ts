import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  decisionsMapFromStore,
  EXISTING_CANONICAL_MAPPING_NOTICE,
  formatMapsToSummary,
  formatSourceTermLabel,
  formatWhereProvenance,
  formatWhereSummary,
  formatWhySummary,
  mergeHydratedDecisions,
  pickNextCandidateIdInList,
  NEW_CANONICAL_KNOWLEDGE_NOTICE,
  REVIEW_CLASS_LABELS,
  REVIEW_DECISIONS_API,
  formatBlockersSummary,
  formatWhatSummary,
  mapsToSectionPreview,
  whatSectionPreview,
  whereSectionPreview,
  whySectionPreview,
  REVIEW_QUESTION_MAPS_TO,
  REVIEW_QUESTION_WHERE,
  REVIEW_QUESTION_WHY,
} from './candidateReviewWorkflow.js';

const SAMPLE_RECORD = {
  candidateId: 'W8178558::canonical_mapping::map-door-lock',
  manualId: 'W8178558',
  reviewClass: 'existingCanonicalMapping',
  reviewStatus: 'unreviewed',
  what: {
    manualId: 'W8178558',
    procedureId: 'w8178558-door-lock',
    sourceTerm: 'door_lock',
  },
  where: {
    pages: [75],
    extractionDoc: 'frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_DUET_SPORT_8178558_EXTRACTION.md',
    provenanceSources: [{ type: 'manual', manualId: 'W8178558' }],
  },
  context: {
    platformId: 'whirlpool_duet_sport',
    inheritedFromManualId: null,
    seedSourceManualId: null,
  },
  mapsTo: {
    proposedCanonicalId: 'door_lock',
    mappingType: 'alias',
    candidateType: 'canonicalMapping',
  },
  why: {
    confidence: 0.94,
    candidateStatus: 'candidate',
  },
};

test('pickNextCandidateIdInList advances to the next visible candidate', () => {
  const list = [
    { candidateId: 'a' },
    { candidateId: 'b' },
    { candidateId: 'c' },
  ];
  assert.equal(pickNextCandidateIdInList(list, 'a'), 'b');
  assert.equal(pickNextCandidateIdInList(list, 'b'), 'c');
  assert.equal(pickNextCandidateIdInList(list, 'c'), 'b');
});

test('mergeHydratedDecisions applies accepted decision without changing reviewClass', () => {
  const merged = mergeHydratedDecisions([SAMPLE_RECORD], {
    decisions: {
      [SAMPLE_RECORD.candidateId]: {
        candidateId: SAMPLE_RECORD.candidateId,
        reviewStatus: 'accepted',
        reviewer: 'tester@example.com',
      },
    },
  });
  assert.equal(merged[0].reviewStatus, 'accepted');
  assert.equal(merged[0].reviewClass, 'existingCanonicalMapping');
  assert.equal(merged[0].what.sourceTerm, 'door_lock');
  assert.equal(merged[0].mapsTo.proposedCanonicalId, 'door_lock');
});

test('mergeHydratedDecisions applies rejected and deferred decisions', () => {
  const rejected = mergeHydratedDecisions([SAMPLE_RECORD], {
    decisions: { [SAMPLE_RECORD.candidateId]: { reviewStatus: 'rejected' } },
  });
  assert.equal(rejected[0].reviewStatus, 'rejected');
  assert.equal(rejected[0].reviewClass, 'existingCanonicalMapping');

  const deferred = mergeHydratedDecisions([SAMPLE_RECORD], {
    decisions: { [SAMPLE_RECORD.candidateId]: { reviewStatus: 'deferred' } },
  });
  assert.equal(deferred[0].reviewStatus, 'deferred');
});

test('missing decision defaults to unreviewed', () => {
  const merged = mergeHydratedDecisions([SAMPLE_RECORD], { decisions: {} });
  assert.equal(merged[0].reviewStatus, 'unreviewed');
});

test('decisionsMapFromStore maps persisted decisions for hydration', () => {
  const map = decisionsMapFromStore({
    decisions: {
      'a::canonical_mapping::x': { reviewStatus: 'accepted' },
      'b::overlay::y': { reviewStatus: 'deferred' },
    },
  });
  assert.deepEqual(map, {
    'a::canonical_mapping::x': 'accepted',
    'b::overlay::y': 'deferred',
  });
});

test('formatWhereProvenance renders available fields', () => {
  const text = formatWhereProvenance(SAMPLE_RECORD);
  assert.match(text, /manualId: W8178558/);
  assert.match(text, /procedureId: w8178558-door-lock/);
  assert.match(text, /extractionDoc:/);
  assert.match(text, /pages: 75/);
  assert.match(text, /platformId: whirlpool_duet_sport/);
  assert.match(text, /provenanceSources:/);
  assert.ok(text.indexOf('extractionDoc:') < text.indexOf('manualId:'));
});

test('where section preview prioritizes extraction doc over manualId', () => {
  const preview = whereSectionPreview(SAMPLE_RECORD);
  assert.equal(preview.primary, 'WHIRLPOOL_DUET_SPORT_8178558_EXTRACTION.md');
  assert.match(preview.secondaryLines.find((l) => l.label === 'pages:')?.value || '', /75/);
});

test('formatWhereProvenance renders safely when fields are missing', () => {
  assert.equal(formatWhereProvenance(null), '—');
  assert.equal(formatWhereProvenance({ manualId: 'ONLY-MANUAL' }), 'manualId: ONLY-MANUAL');
  assert.equal(formatWhereProvenance({}), '—');
});

test('review question summaries support at-a-glance mobile review', () => {
  assert.equal(formatSourceTermLabel(SAMPLE_RECORD), 'door_lock');
  assert.match(formatMapsToSummary(SAMPLE_RECORD), /door_lock/);
  assert.match(formatMapsToSummary(SAMPLE_RECORD), /alias/);
  assert.match(formatWhereSummary(SAMPLE_RECORD), /WHIRLPOOL_DUET_SPORT_8178558_EXTRACTION\.md/);
  assert.match(formatWhereSummary(SAMPLE_RECORD), /pages: 75/);
  assert.match(formatWhySummary(SAMPLE_RECORD), /confidence: 0.94/);
  assert.match(formatWhySummary(SAMPLE_RECORD), /candidateStatus: candidate/);
});

test('review section question labels remain available for guidance copy', () => {
  assert.equal(REVIEW_QUESTION_MAPS_TO, 'What does it map to?');
  assert.equal(REVIEW_QUESTION_WHERE, 'Where did it come from?');
  assert.equal(REVIEW_QUESTION_WHY, 'Why did the system produce it?');
});

test('mapsTo section preview uses proposedCanonicalId as dominant primary line', () => {
  const preview = mapsToSectionPreview(SAMPLE_RECORD);
  assert.equal(preview.primary, 'door_lock');
  assert.ok(!preview.secondaryLines.some((line) => line.label === 'proposedCanonicalId:'));
  assert.equal(preview.secondaryLines[0]?.label, 'mappingType:');
});

test('what section preview uses manualId as dominant primary line', () => {
  const preview = whatSectionPreview(SAMPLE_RECORD);
  assert.equal(preview.primary, 'W8178558');
  assert.equal(preview.secondaryLines.length, 2);
  assert.equal(preview.secondaryLines[0].label, 'procedureId:');
  assert.equal(preview.secondaryLines[1].label, 'sourceTerm:');
  assert.equal(preview.secondaryLines[1].value, 'door_lock');
});

test('why section preview bolds confidence and keeps candidateStatus secondary', () => {
  const preview = whySectionPreview(SAMPLE_RECORD);
  const confidence = preview.secondaryLines.find((line) => line.label === 'confidence:');
  assert.equal(confidence?.emphasize, true);
  assert.equal(
    preview.secondaryLines.find((line) => line.label === 'candidateStatus:')?.value,
    'candidate',
  );
});

test('accordion summaries cover source and blockers glance text', () => {
  assert.match(formatWhatSummary(SAMPLE_RECORD), /W8178558/);
  assert.match(formatWhatSummary(SAMPLE_RECORD), /door_lock/);
  assert.equal(formatBlockersSummary({ blockers: {} }), '—');
  assert.equal(
    formatBlockersSummary({ blockers: { blockedReason: 'needs_review' } }),
    'needs_review',
  );
});

test('existingCanonicalMapping retains non-promotion wording', () => {
  assert.match(EXISTING_CANONICAL_MAPPING_NOTICE, /existing frozen canonical function/i);
  assert.match(EXISTING_CANONICAL_MAPPING_NOTICE, /does not modify or promote/i);
  assert.equal(REVIEW_CLASS_LABELS.existingCanonicalMapping, 'Existing canonical mapping');
  assert.match(NEW_CANONICAL_KNOWLEDGE_NOTICE, /architecture gate required/i);
});

test('workbench hydrates decisions from API on mount', () => {
  const source = readFileSync(join(process.cwd(), 'components/solomon/knowledge/CandidateReviewWorkbench.js'), 'utf8');
  assert.match(source, /fetch\(REVIEW_DECISIONS_API\)/);
  assert.match(source, /useEffect/);
  assert.match(source, /decisionsMapFromStore/);
  assert.equal(REVIEW_DECISIONS_API, '/api/knowledge/normalization/review/decisions');
});

test('no bulk decision path exists in workbench', () => {
  const source = readFileSync(join(process.cwd(), 'components/solomon/knowledge/CandidateReviewWorkbench.js'), 'utf8');
  assert.ok(!/bulk/i.test(source));
  assert.ok(!/approve all/i.test(source));
  assert.ok(!/accept all/i.test(source));
});

test('workbench advances selection after a saved decision', () => {
  const source = readFileSync(join(process.cwd(), 'components/solomon/knowledge/CandidateReviewWorkbench.js'), 'utf8');
  assert.match(source, /pickNextCandidateIdInList/);
  assert.match(source, /setSelectedId\(nextId\)/);
});

test('detail panel accordion keeps section preview visible and toggles independently', () => {
  const detail = readFileSync(
    join(process.cwd(), 'components/solomon/knowledge/CandidateReviewDetailPanel.js'),
    'utf8',
  );
  assert.match(detail, /openSections/);
  assert.match(detail, /setOpenSections\(\{\}\)/);
  assert.match(detail, /SectionPreviewBlock/);
  assert.match(detail, /SectionPreviewBlock preview=\{preview\}/);
  assert.match(detail, /reviewSectionPreviewsForCandidate/);
  assert.match(detail, /sectionPreviews\.what/);
  assert.match(detail, /font-semibold/);
});

test('presentation refactor preserves existing review flow contract', () => {
  const workbench = readFileSync(
    join(process.cwd(), 'components/solomon/knowledge/CandidateReviewWorkbench.js'),
    'utf8',
  );
  const detail = readFileSync(
    join(process.cwd(), 'components/solomon/knowledge/CandidateReviewDetailPanel.js'),
    'utf8',
  );
  assert.match(workbench, /reviewIndex\.candidateRecords/);
  assert.match(workbench, /method: 'POST'/);
  assert.match(workbench, /REVIEW_DECISIONS_API/);
  assert.match(workbench, /filtered\.map/);
  assert.ok(!detail.includes('fetch('));
  assert.ok(!detail.includes('plan_promotion'));
});
