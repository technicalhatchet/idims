import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('matcher improvement scoped validation artifact is GREEN', () => {
  const path = join(CALIBRATION, 'CG_MATCHER_IMPROVEMENT_SCOPED_VALIDATION_v1.json');
  assert.ok(existsSync(path), 'run backend/scripts/run_matcher_improvement_scoped_validation.py');
  const validation = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(validation.status, 'GREEN');
  assert.equal(validation.productionIntegrity.unchanged, true);
  assert.equal(validation.frozenHashVerification.passed, true);
  assert.equal(validation.governanceProof.deferredImplementationViolations.length, 0);
  assert.equal(validation.governanceProof.rejectedImplementationViolations.length, 0);
  assert.equal(validation.governanceProof.rejectedBacklogIdUntouched, 'efmm-64d66fbb30c3');
  assert.ok(validation.aggregate.deltas.matcherImprovementCount >= 1);
  assert.equal(validation.wave1Regression.passed, true);
  assert.equal(validation.wave2Regression.passed, true);
});
