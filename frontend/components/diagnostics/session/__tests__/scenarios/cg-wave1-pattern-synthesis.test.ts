import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const SYNTHESIS = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration/CG_WAVE1_PATTERN_SYNTHESIS_v1.json',
);

test('wave1 pattern synthesis artifact exists with expected sections', () => {
  assert.ok(
    existsSync(SYNTHESIS),
    'run backend/scripts/run_wave1_pattern_synthesis.py to generate synthesis artifact',
  );
  const payload = JSON.parse(readFileSync(SYNTHESIS, 'utf8'));
  assert.equal(payload.reportType, 'cg_wave1_pattern_synthesis');
  assert.equal(payload.oemTestHeadingAnalysis.wave1Count, 33);
  assert.equal(payload.manualSectionHeadingAnalysis.wave1Count, 6);
  assert.equal(payload.manualSectionHeadingAnalysis.wave1ReviewStatusCounts.deferred, 4);
  assert.equal(payload.supplyTerminologyAnalysis.wave1.count, 36);
  assert.equal(payload.recommendedNextAction.productionMutationAuthorized, false);
});

test('wave1 pattern synthesis documents supply split without mutating production', () => {
  const payload = JSON.parse(readFileSync(SYNTHESIS, 'utf8'));
  assert.equal(payload.supplyTerminologyAnalysis.wave1.mappingCounts.power_supply, 30);
  assert.equal(payload.supplyTerminologyAnalysis.wave1.mappingCounts.supply, 6);
  assert.equal(payload.mutationPolicy.normalizationPipelineMutated, false);
});
