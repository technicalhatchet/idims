import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const REVIEW = join(process.cwd(), 'components/diagnostics/knowledge/normalization/review');

test('matcher-reconciled candidate review gate artifacts are GREEN', () => {
  const reviewPath = join(CALIBRATION, 'CG_MATCHER_RECONCILED_CANDIDATE_REVIEW_v1.json');
  const auditPath = join(CALIBRATION, 'CG_MATCHER_RECONCILED_CANDIDATE_REVIEW_AUDIT_v1.json');
  assert.ok(existsSync(reviewPath), 'run matcher-reconciled candidate review gate');
  assert.ok(existsSync(auditPath));
  const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
  assert.equal(review.status, 'GREEN');
  assert.equal(review.expectedScopeCount, 52);
  assert.equal(review.canonicalPromotionImplied, false);
  assert.equal((review.scopeRecords || []).length, 52);
  const decisionsPath = join(REVIEW, 'CG_MATCHER_RECONCILED_CANDIDATE_REVIEW_DECISIONS_v1.json');
  assert.ok(existsSync(decisionsPath));
});

test('workbench exposes matcher-reconciled review queue', () => {
  const workbench = readFileSync(
    join(process.cwd(), 'components/solomon/knowledge/CandidateReviewWorkbench.js'),
    'utf8',
  );
  assert.match(workbench, /matcherReconciled/);
  assert.match(workbench, /MatcherReconciledCandidateDetailPanel/);
  assert.match(workbench, /MATCHER_RECONCILED_CANDIDATE_REVIEW_DECISIONS_API/);
});
