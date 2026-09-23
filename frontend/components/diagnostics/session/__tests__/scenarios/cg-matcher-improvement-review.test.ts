import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('matcher improvement review gate is ready with 17 items', () => {
  const path = join(CALIBRATION, 'CG_MATCHER_IMPROVEMENT_REVIEW_v1.json');
  assert.ok(existsSync(path), 'run backend/scripts/run_matcher_improvement_review_preflight.py');
  const review = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(review.status, 'READY_FOR_HUMAN_MATCHER_IMPROVEMENT_REVIEW');
  assert.equal(review.reviewItemCount, 17);
  assert.equal(review.matcherImplementationAllowed, false);
  assert.equal(review.implementationAuthorized, false);
  review.reviewItems.forEach((item: { implementationAuthorized?: boolean }) => {
    assert.equal(item.implementationAuthorized, false);
  });
});

test('matcher improvement review audit preflight integrity passes', () => {
  const path = join(CALIBRATION, 'CG_MATCHER_IMPROVEMENT_REVIEW_AUDIT_v1.json');
  assert.ok(existsSync(path));
  const audit = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(audit.status, 'READY_FOR_HUMAN_MATCHER_IMPROVEMENT_REVIEW');
  assert.equal(audit.integrityChecks.passed, true);
  assert.equal(audit.integrityChecks.reviewItemCount, 17);
  assert.equal(audit.mutationChecks.matcherChanged, false);
});

test('workbench exposes matcher improvement review queue', () => {
  const workbench = readFileSync(
    join(process.cwd(), 'components/solomon/knowledge/CandidateReviewWorkbench.js'),
    'utf8',
  );
  assert.match(workbench, /matcherImprovement/);
  assert.match(workbench, /MatcherImprovementReviewGuidancePanel/);
});
