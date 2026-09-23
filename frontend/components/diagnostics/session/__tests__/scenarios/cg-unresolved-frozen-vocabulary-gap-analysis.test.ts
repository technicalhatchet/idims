import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('frozen vocabulary gap analysis completes read-only with 1078 gap records', () => {
  const path = join(CALIBRATION, 'CG_UNRESOLVED_FROZEN_VOCABULARY_GAP_ANALYSIS_v1.json');
  assert.ok(existsSync(path), 'run backend/scripts/run_unresolved_frozen_vocabulary_gap_analysis.py');
  const analysis = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(analysis.status, 'READ_ONLY_MATCHER_GAP_ANALYSIS_COMPLETE');
  assert.equal(analysis.canonicalMappingGapCount, 1078);
  assert.equal(analysis.procedureTestBindingUnresolvedCount, 22);
  assert.equal(analysis.mutationPolicy.newCanonicalKnowledgeAssigned, false);
  assert.equal(analysis.governanceSignalsPreserved.AMBIGUOUS_COMPONENT.count, 35);
});

test('frozen vocabulary gap analysis audit integrity checks pass', () => {
  const path = join(CALIBRATION, 'CG_UNRESOLVED_FROZEN_VOCABULARY_GAP_ANALYSIS_AUDIT_v1.json');
  assert.ok(existsSync(path));
  const audit = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(audit.status, 'READ_ONLY_MATCHER_GAP_ANALYSIS_COMPLETE');
  assert.equal(audit.integrityChecks.passed, true);
  assert.equal(audit.integrityChecks.canonicalMappingGapCount, 1078);
  assert.equal(audit.integrityChecks.unresolvedCount, 1100);
});
