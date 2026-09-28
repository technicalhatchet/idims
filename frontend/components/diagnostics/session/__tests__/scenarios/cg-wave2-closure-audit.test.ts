import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const WAVES = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/review/waves',
);
const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const DECISIONS = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/review/CG_PRODUCTION_NORMALIZATION_CANDIDATE_REVIEW_DECISIONS_v1.json',
);

test('wave2 closure audit artifact reports WAVE2_CLOSED with 426/426 reviewed', () => {
  const path = join(WAVES, 'CG_WAVE2_NEW_PLATFORM_KNOWLEDGE_CLOSURE_AUDIT_v1.json');
  assert.ok(existsSync(path), 'run backend/scripts/run_wave2_closure_audit.py');
  const audit = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(audit.status, 'WAVE2_CLOSED');
  assert.equal(audit.expectedCandidateCount, 426);
  assert.equal(audit.reviewedCandidateCount, 426);
  assert.equal(audit.missingDecisionCount, 0);
  assert.equal(audit.duplicateDecisionCount, 0);
  assert.equal(audit.outOfWaveDecisionCount, 0);
  assert.equal(audit.promotionPerformed, false);
  assert.equal(audit.canonicalMutationDetected, false);
  assert.equal(audit.candidateMutationDetected, false);
  assert.equal(audit.wave1Integrity.passed, true);
  assert.equal(audit.frozenHashValidation.passed, true);
});

test('wave2 pattern synthesis is governance-only', () => {
  const path = join(CALIBRATION, 'CG_WAVE2_PATTERN_SYNTHESIS_v1.json');
  assert.ok(existsSync(path), 'run backend/scripts/run_wave2_pattern_synthesis.py');
  const synthesis = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(synthesis.status, 'READ_ONLY_SYNTHESIS_COMPLETE');
  assert.equal(synthesis.mutationPolicy.automaticFilteringRulesApplied, false);
  assert.equal(synthesis.mutationPolicy.normalizationPipelineMutated, false);
  assert.ok(Array.isArray(synthesis.findings) && synthesis.findings.length > 0);
});

test('decisions artifact includes wave1 and wave2 without promotion fields', () => {
  const store = JSON.parse(readFileSync(DECISIONS, 'utf8'));
  assert.equal(Object.keys(store.decisions).length, 796);
  assert.ok(!('promotionApplied' in store));
});
