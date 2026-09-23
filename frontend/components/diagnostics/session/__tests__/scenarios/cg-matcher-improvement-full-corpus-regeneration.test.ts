import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('matcher improvement full corpus regeneration artifact is GREEN', () => {
  const path = join(CALIBRATION, 'CG_MATCHER_IMPROVEMENT_FULL_CORPUS_REGENERATION_v1.json');
  assert.ok(
    existsSync(path),
    'run backend/scripts/run_matcher_improvement_full_corpus_regeneration.py',
  );
  const regen = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(regen.status, 'GREEN');
  assert.equal(regen.promotionGate, false);
  assert.equal(regen.productionCandidatesUntouched, true);
  assert.equal(regen.cohort.totalManuals, 72);
  assert.equal(regen.humanReviewIntegrity.passed, true);
  assert.equal(regen.deltas.architectureException, 0);
  assert.equal(regen.productionIntegrity.unchanged, true);
});
