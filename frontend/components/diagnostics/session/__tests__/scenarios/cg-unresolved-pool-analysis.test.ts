import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('unresolved pool analysis artifact is read-only complete with 1100 unresolved', () => {
  const path = join(CALIBRATION, 'CG_UNRESOLVED_POOL_ANALYSIS_v1.json');
  assert.ok(existsSync(path), 'run backend/scripts/run_unresolved_pool_analysis.py');
  const analysis = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(analysis.status, 'READ_ONLY_ANALYSIS_COMPLETE');
  assert.equal(analysis.totalUnresolvedCount, 1100);
  assert.equal(analysis.mutationPolicy.readOnly, true);
  assert.equal(analysis.mutationPolicy.reclassifiedCandidates, false);
});

test('unresolved pool analysis audit proves integrity checks passed', () => {
  const path = join(CALIBRATION, 'CG_UNRESOLVED_POOL_ANALYSIS_AUDIT_v1.json');
  assert.ok(existsSync(path));
  const audit = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(audit.status, 'READ_ONLY_ANALYSIS_COMPLETE');
  assert.equal(audit.integrityChecks.passed, true);
  assert.equal(audit.integrityChecks.unresolvedCountBefore, 1100);
  assert.equal(audit.integrityChecks.unresolvedCountAfter, 1100);
  assert.equal(audit.integrityChecks.wave3Empty, true);
});
