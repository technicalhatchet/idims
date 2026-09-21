import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('existing frozen mapping missed drilldown analyzes 374 records read-only', () => {
  const path = join(CALIBRATION, 'CG_EXISTING_FROZEN_MAPPING_MISSED_DRILLDOWN_v1.json');
  assert.ok(
    existsSync(path),
    'run backend/scripts/run_existing_frozen_mapping_missed_drilldown.py',
  );
  const drilldown = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(drilldown.status, 'READ_ONLY_FROZEN_MAPPING_MISSED_DRILLDOWN_COMPLETE');
  assert.equal(drilldown.analyzedRecordCount, 374);
  assert.equal(drilldown.mutationPolicy.matcherChanged, false);
  assert.equal(drilldown.mutationPolicy.aliasesAdded, false);
  assert.ok(Array.isArray(drilldown.matcherImprovementBacklog));
});

test('existing frozen mapping missed drilldown audit integrity passes', () => {
  const path = join(CALIBRATION, 'CG_EXISTING_FROZEN_MAPPING_MISSED_DRILLDOWN_AUDIT_v1.json');
  assert.ok(existsSync(path));
  const audit = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(audit.status, 'READ_ONLY_FROZEN_MAPPING_MISSED_DRILLDOWN_COMPLETE');
  assert.equal(audit.integrityChecks.passed, true);
  assert.equal(audit.integrityChecks.analyzedExistingFrozenMappingMissedCount, 374);
});
