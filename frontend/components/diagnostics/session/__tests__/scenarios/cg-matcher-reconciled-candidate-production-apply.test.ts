import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const REVIEW = join(process.cwd(), 'components/diagnostics/knowledge/normalization/review');

test('matcher-reconciled production apply preflight artifacts are GREEN without mutation', () => {
  const applyPath = join(CALIBRATION, 'CG_MATCHER_RECONCILED_CANDIDATE_PRODUCTION_APPLY_v1.json');
  const lockPath = join(CALIBRATION, 'CG_MATCHER_RECONCILED_CANDIDATE_PRODUCTION_APPLY_LOCK_v1.json');
  const closurePath = join(CALIBRATION, 'CG_MATCHER_RECONCILED_CANDIDATE_REVIEW_CLOSURE_v1.json');
  assert.ok(existsSync(closurePath), 'closure must exist');
  assert.ok(existsSync(applyPath), 'run production apply preflight gate');
  assert.ok(existsSync(lockPath));
  const closure = JSON.parse(readFileSync(closurePath, 'utf8'));
  assert.equal(closure.status, 'GREEN');
  assert.equal(closure.acceptedCount, 52);
  const apply = JSON.parse(readFileSync(applyPath, 'utf8'));
  assert.equal(apply.status, 'GREEN');
  assert.equal(apply.productionMutationsExecuted, false);
  assert.equal(apply.canonicalPromotionImplied, false);
  assert.equal(apply.mergedInto796Decisions, false);
  assert.equal(apply.summary.authorizedScope, 52);
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  assert.equal(lock.applyAuthorizationGranted, false);
  assert.equal(lock.productionMutationsExecuted, false);
  const decisions796 = join(REVIEW, 'CG_PRODUCTION_NORMALIZATION_CANDIDATE_REVIEW_DECISIONS_v1.json');
  const decisions52 = join(REVIEW, 'CG_MATCHER_RECONCILED_CANDIDATE_REVIEW_DECISIONS_v1.json');
  assert.ok(existsSync(decisions796));
  assert.ok(existsSync(decisions52));
});
