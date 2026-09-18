import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  decisionsMapFromStore,
  EXISTING_CANONICAL_MAPPING_NOTICE,
  formatWhereProvenance,
  mergeHydratedDecisions,
  NEW_CANONICAL_KNOWLEDGE_NOTICE,
  REVIEW_CLASS_LABELS,
  REVIEW_DECISIONS_API,
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
  mapsTo: { proposedCanonicalId: 'door_lock' },
};

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
});

test('formatWhereProvenance renders safely when fields are missing', () => {
  assert.equal(formatWhereProvenance(null), '—');
  assert.equal(formatWhereProvenance({ manualId: 'ONLY-MANUAL' }), 'manualId: ONLY-MANUAL');
  assert.equal(formatWhereProvenance({}), '—');
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
