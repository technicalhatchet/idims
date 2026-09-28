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

test('resume contract — resume authorization separate from execution lock', () => {
  const resumeContract = readJson('CG_PRODUCTION_NORMALIZATION_BATCH_RESUME_CONTRACT_v1.json');
  const rules = resumeContract.rules as {
    resumeAuthorizationSeparateFromExecutionLock: boolean;
    executionLockRemainsIndependentGate: boolean;
    resumeRequiresAuthorizationArtifact: boolean;
    topLevelAuthorizationTupleAuthoritative: boolean;
    noGlobalArchitectureExceptionBypass: boolean;
    forceFalseUnlessExplicitForceManual: boolean;
  };

  assert.equal(rules.resumeAuthorizationSeparateFromExecutionLock, true);
  assert.equal(rules.executionLockRemainsIndependentGate, true);
  assert.equal(rules.resumeRequiresAuthorizationArtifact, true);
  assert.equal(rules.topLevelAuthorizationTupleAuthoritative, true);
  assert.equal(rules.noGlobalArchitectureExceptionBypass, true);
  assert.equal(rules.forceFalseUnlessExplicitForceManual, true);
});

test('resume authorization artifact — frozen observation identity encoded', () => {
  const resumeAuth = readJson(
    'CG_PRODUCTION_NORMALIZATION_BATCH_RESUME_AUTHORIZATION_batch-20260918-5d213986.json',
  );
  const clearances = resumeAuth.architectureExceptionClearances as Array<{
    manualId: string;
    reNormalize: boolean;
  }>;

  assert.equal(resumeAuth.batchRunId, 'batch-20260918-5d213986');
  assert.equal(
    resumeAuth.observationManifestHash,
    '857b4852617ac8169fb2e5cb48d4cd3475500f40d6e89d5fe800aea46bd24f4e',
  );
  assert.equal(
    resumeAuth.processingManifestHash,
    '0d537288a76ed9b2bdc3fd7fec8ccb9e5187bf282dc68b917790a1fd184a4013',
  );
  assert.equal(clearances.length, 1);
  assert.equal(clearances[0].manualId, 'SAMSUNG-FLEXWASH-WASHER');
  assert.equal(clearances[0].reNormalize, false);
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
