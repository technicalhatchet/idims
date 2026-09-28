import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('matcher improvement delta review is ready without promotion', () => {
  const path = join(CALIBRATION, 'CG_MATCHER_IMPROVEMENT_DELTA_REVIEW_v1.json');
  assert.ok(existsSync(path), 'run backend/scripts/run_matcher_improvement_delta_review.py');
  const review = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(review.status, 'GREEN — DELTA REVIEW READY');
  assert.equal(review.productionSwapAllowed, false);
  assert.equal(review.counts.allDeltas, 54);
  assert.equal(review.counts.matcherImprovementMappings, 46);
  assert.equal(review.counts.addedToUnresolved, 12);
  assert.equal(review.counts.removedViaMatcherImprovement, 46);
  assert.equal(review.counts.removedViaOtherPaths, 12);
  assert.equal(review.counts.unexplainedNonAuthorized, 0);
  assert.equal(review.humanReviewSafety.productionCandidatesUntouched, true);
  const summaryPath = join(CALIBRATION, 'CG_MATCHER_IMPROVEMENT_DELTA_REVIEW_WORKBENCH_SUMMARY_v1.json');
  assert.ok(existsSync(summaryPath));
});
