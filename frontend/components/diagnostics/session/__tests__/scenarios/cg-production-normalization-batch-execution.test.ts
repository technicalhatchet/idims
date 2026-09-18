import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const REPO_ROOT = resolve(process.cwd(), '..');

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(CALIBRATION, name), 'utf8'));
}

test('execution lock — orchestrator built, execution NOT authorized', () => {
  const lock = readJson('CG_PRODUCTION_NORMALIZATION_BATCH_EXECUTION_LOCK_v1.json');
  const report = readJson('CG_PRODUCTION_NORMALIZATION_BATCH_EXECUTION_REPORT_v1.json');

  assert.equal(lock.status, 'orchestrator_built_not_authorized');
  assert.equal(
    (lock.headlineMetrics as { normalizationBatchAuthorized: boolean }).normalizationBatchAuthorized,
    false,
  );
  assert.equal(
    (lock.headlineMetrics as { batchExecutionAuthorized: boolean }).batchExecutionAuthorized,
    false,
  );
  assert.equal(report.executionAuthorized, false);
  assert.equal(report.verdict, 'ORCHESTRATOR_GREEN — EXECUTION NOT AUTHORIZED');
});

test('batch contract — cohort manifest freeze requirement encoded', () => {
  const contract = readJson('CG_PRODUCTION_NORMALIZATION_BATCH_CONTRACT_v1.json');
  const freeze = contract.cohortManifestFreeze as {
    requiredBeforeExecution: boolean;
    recordedFields: string[];
    implementation: string;
  };

  assert.equal(freeze.requiredBeforeExecution, true);
  assert.ok(freeze.recordedFields.includes('batchRunId'));
  assert.ok(freeze.recordedFields.includes('manifestHash'));
  assert.ok(freeze.implementation.includes('batch_orchestrator.py'));
});

test('orchestrator modules exist on disk', () => {
  const orchestrator = join(
    REPO_ROOT,
    'backend/scripts/normalization/batch_orchestrator.py',
  );
  const cli = join(REPO_ROOT, 'backend/scripts/run_production_normalization_batch.py');
  assert.ok(existsSync(orchestrator));
  assert.ok(existsSync(cli));
});

test('CLI fails closed without locked authorization', () => {
  let exitCode = 0;
  try {
    execFileSync(
      'python',
      [join(REPO_ROOT, 'backend/scripts/run_production_normalization_batch.py')],
      { cwd: REPO_ROOT, stdio: 'pipe' },
    );
  } catch (error) {
    const err = error as { status?: number };
    exitCode = err.status ?? 1;
  }
  assert.equal(exitCode, 2);
});
