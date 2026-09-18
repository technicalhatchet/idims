import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

test('execution lock — top-level authorization tuple is authoritative', () => {
  const lock = readJson('CG_PRODUCTION_NORMALIZATION_BATCH_EXECUTION_LOCK_v1.json');
  const topLevelNorm = lock.normalizationBatchAuthorized as boolean | undefined;
  const topLevelBatch = lock.batchExecutionAuthorized as boolean | undefined;
  const headline = (lock.headlineMetrics ?? {}) as {
    normalizationBatchAuthorized?: boolean;
    batchExecutionAuthorized?: boolean;
  };

  assert.equal(typeof topLevelNorm, 'boolean');
  assert.equal(typeof topLevelBatch, 'boolean');
  if (headline.normalizationBatchAuthorized !== undefined) {
    assert.equal(headline.normalizationBatchAuthorized, topLevelNorm);
  }
  if (headline.batchExecutionAuthorized !== undefined) {
    assert.equal(headline.batchExecutionAuthorized, topLevelBatch);
  }
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

test('CLI fails closed without top-level authorization', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'cg-batch-auth-'));
  const lockPath = join(tempDir, 'unauthorized-lock.json');
  writeFileSync(
    lockPath,
    JSON.stringify({
      headlineMetrics: {
        normalizationBatchAuthorized: true,
        batchExecutionAuthorized: true,
      },
    }),
    'utf8',
  );

  let exitCode = 0;
  try {
    execFileSync(
      'python',
      [
        join(REPO_ROOT, 'backend/scripts/run_production_normalization_batch.py'),
        '--execution-lock',
        lockPath,
        '--dry-run',
        '--max-manuals',
        '0',
      ],
      { cwd: REPO_ROOT, stdio: 'pipe' },
    );
  } catch (error) {
    const err = error as { status?: number };
    exitCode = err.status ?? 1;
  }
  assert.equal(exitCode, 2);
});
