import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import { FROZEN_MICROWAVE_REV1_HASH } from '../../../knowledge/canonical/canonicalRegistry';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANONICAL = resolve(process.cwd(), 'components/diagnostics/knowledge/canonical');

const RANGE_OVEN_HASH =
  'e29bb5fafe2afacdba3b45a1ec8e4ec0b73c78d51ff6319bb6a7c0e20a7b4fc5';

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('CG_MICROWAVE_NORMALIZATION_AUDIT approved — governance hold resolved', () => {
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_NORMALIZATION_AUDIT_v1.json'), 'utf8'),
  );

  assert.equal(audit.status, 'approved');
  assert.equal(audit.governanceHold.resolved, true);
  assert.ok(audit.priorRevision.resolution.includes('rf_cavity'));

  const failed = audit.auditChecks.filter((c: { result: string }) => c.result === 'fail');
  assert.equal(failed.length, 0);

  const magnetronCheck = audit.auditChecks.find(
    (c: { id: string }) => c.id === 'magnetron_rf_cavity_realization',
  );
  assert.equal(magnetronCheck?.result, 'pass');
});

test('normalization audit confirms frozen microwave and range_oven byte stability', () => {
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_NORMALIZATION_AUDIT_v1.json'), 'utf8'),
  );

  assert.equal(sha256File(join(CANONICAL, 'microwave.json')), FROZEN_MICROWAVE_REV1_HASH);
  assert.equal(audit.frozenContract.frozenHash, FROZEN_MICROWAVE_REV1_HASH);
  assert.equal(audit.frozenContract.mutated, false);
  assert.equal(sha256File(join(CANONICAL, 'range_oven.json')), RANGE_OVEN_HASH);
  assert.equal(audit.regressionProof.testsPassing, 11);
});
