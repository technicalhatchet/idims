import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const REVIEW = join(process.cwd(), 'components/diagnostics/knowledge/normalization/review');

test('delta reconciliation preflight artifacts are ready', () => {
  const reconPath = join(CALIBRATION, 'CG_MATCHER_IMPROVEMENT_DELTA_RECONCILIATION_v1.json');
  const queuePath = join(CALIBRATION, 'CG_MATCHER_IMPROVEMENT_DELTA_RECONCILIATION_QUEUE_v1.json');
  assert.ok(existsSync(reconPath), 'run delta reconciliation preflight');
  assert.ok(existsSync(queuePath));
  const recon = JSON.parse(readFileSync(reconPath, 'utf8'));
  assert.equal(recon.status, 'GREEN — DELTA RECONCILIATION READY');
  assert.equal(recon.promotionGate, false);
  assert.equal(recon.populationSummary.populationA, 46);
  const queue = JSON.parse(readFileSync(queuePath, 'utf8'));
  assert.equal((queue.populationA || []).length, 46);
  assert.ok((queue.populationB || []).length >= 8);
  const decisionsPath = join(REVIEW, 'CG_MATCHER_IMPROVEMENT_DELTA_RECONCILIATION_DECISIONS_v1.json');
  assert.ok(existsSync(decisionsPath));
});

test('workbench exposes separate delta reconciliation populations', () => {
  const workbench = readFileSync(
    join(process.cwd(), 'components/solomon/knowledge/CandidateReviewWorkbench.js'),
    'utf8',
  );
  assert.match(workbench, /deltaReconciliationA/);
  assert.match(workbench, /deltaReconciliationB/);
  assert.match(workbench, /DeltaReconciliationDetailPanel/);
  assert.match(workbench, /DELTA_RECONCILIATION_DECISIONS_API/);
});
