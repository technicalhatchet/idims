import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('final delta reconciliation and production manifest are GREEN', () => {
  const finalPath = join(CALIBRATION, 'CG_MATCHER_IMPROVEMENT_DELTA_RECONCILIATION_FINAL_v1.json');
  const manifestPath = join(CALIBRATION, 'CG_MATCHER_IMPROVEMENT_PRODUCTION_RECONCILIATION_MANIFEST_v1.json');
  assert.ok(existsSync(finalPath), 'run run_matcher_improvement_delta_reconciliation_final.py');
  assert.ok(existsSync(manifestPath));
  const final = JSON.parse(readFileSync(finalPath, 'utf8'));
  assert.equal(final.status, 'GREEN');
  assert.equal(final.totals.authorizedForProductionReconciliation, 52);
  assert.equal(final.totals.populationAAccepted, 46);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.authorizedRecordCount, 52);
  assert.equal(manifest.soleAuthorityForNextGate, true);
  assert.equal(manifest.canonicalPromotionImplied, false);
});
