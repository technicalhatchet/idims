import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('matcher improvement implementation audit is GREEN with frozen hashes', () => {
  const path = join(CALIBRATION, 'CG_MATCHER_IMPROVEMENT_IMPLEMENTATION_AUDIT_v1.json');
  assert.ok(existsSync(path), 'run backend/scripts/run_matcher_improvement_implementation.py');
  const audit = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(audit.status, 'GREEN');
  assert.equal(audit.frozenHashVerification.passed, true);
  assert.ok(audit.approvedBacklogIdsImplemented.length >= 8);
  assert.equal(audit.rejectedBacklogIdsUntouched.length, 1);
});
