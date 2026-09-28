import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const CANDIDATES = join(process.cwd(), 'components/diagnostics/knowledge/normalization/candidates');
const REPO_ROOT = resolve(process.cwd(), '..');

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(CALIBRATION, name), 'utf8'));
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('pilot closure — GREEN gate closed, batch NOT authorized', () => {
  const closure = readJson('CG_PRODUCTION_NORMALIZATION_PILOT_CLOSURE_v1.json');
  const lock = readJson('CG_PRODUCTION_NORMALIZATION_PILOT_LOCK_v1.json');
  const analysis = readJson('CG_PRODUCTION_NORMALIZATION_PILOT_CLOSURE_ANALYSIS_v1.json');

  assert.equal(closure.status, 'closed');
  assert.equal(closure.verdict, 'GREEN / PILOT_GATE_CLOSED');
  assert.equal(closure.authorizesProductionBatch, false);
  assert.equal(closure.authorizesBatchContract, true);
  assert.equal(lock.verdict, 'CLOSED / PILOT_GATE_GREEN');
  assert.equal((lock.headlineMetrics as { pilotGateClosed: boolean }).pilotGateClosed, true);
  assert.equal(
    (lock.headlineMetrics as { normalizationBatchAuthorized: boolean }).normalizationBatchAuthorized,
    false,
  );
  assert.equal(analysis.gateVerdict, 'GREEN');
  assert.equal(analysis.pilotClosureRecommended, true);
});

test('closure analysis — all four lifecycle branches demonstrated across 8 slots', () => {
  const analysis = readJson('CG_PRODUCTION_NORMALIZATION_PILOT_CLOSURE_ANALYSIS_v1.json');
  const lifecycle = analysis.lifecycleProofAssessment as Record<
    string,
    { verdict: string; observed?: boolean }
  >;
  const checklist = analysis.gateCriteriaChecklist as {
    allRequiredMet: boolean;
    items: Array<{ criterion: string; met: boolean }>;
  };

  assert.equal(lifecycle.canonical_mapping_continue.verdict, 'SATISFIED');
  assert.equal(lifecycle.implementation_specific_overlay.verdict, 'SATISFIED');
  assert.equal(lifecycle.unresolved_block.verdict, 'SATISFIED — promotion blocked without guessing');
  assert.equal(lifecycle.architecture_exception_stop.verdict, 'SATISFIED');
  assert.equal(checklist.allRequiredMet, true);
  assert.equal(checklist.items.every((item) => item.met), true);

  const slots = analysis.slotDispositionMatrix as Array<{ slotId: string }>;
  assert.equal(slots.length, 8);
});

test('P08 — STOP preserved; integration frozen; normalization not authorized by closure', () => {
  const closure = readJson('CG_PRODUCTION_NORMALIZATION_PILOT_CLOSURE_v1.json');
  const analysis = readJson('CG_PRODUCTION_NORMALIZATION_PILOT_CLOSURE_ANALYSIS_v1.json');
  const p08 = analysis.p08ArchitectureResolution as {
    pipelineBehavior: string;
    doesNotRequireFlexWashNormalizationNow: boolean;
  };

  assert.equal(
    (closure.p08Resolution as { pipelineDisposition: string }).pipelineDisposition,
    'architecture_exception_stop',
  );
  assert.equal(
    (closure.p08Resolution as { flexWashNormalizationAuthorized: boolean }).flexWashNormalizationAuthorized,
    false,
  );
  assert.equal(p08.pipelineBehavior, 'architecture_exception_stop — unchanged and correct');
  assert.equal(p08.doesNotRequireFlexWashNormalizationNow, true);

  const exceptionPath = join(
    CANDIDATES,
    'SAMSUNG-FLEXWASH-WASHER',
    'architecture_exception.json',
  );
  assert.ok(existsSync(exceptionPath));
  const exception = JSON.parse(readFileSync(exceptionPath, 'utf8'));
  assert.equal(exception.batchDisposition, 'STOP');
});

test('P05 fix verified in closure evidence — no collateral regression claimed', () => {
  const analysis = readJson('CG_PRODUCTION_NORMALIZATION_PILOT_CLOSURE_ANALYSIS_v1.json');
  const p05 = (analysis.slotDispositionMatrix as Array<{ slotId: string; disposition: string }>).find(
    (s) => s.slotId === 'P05',
  );
  assert.ok(p05);
  assert.equal(p05?.disposition, 'implementation_specific');
  assert.ok(existsSync(join(CALIBRATION, 'CG_PILOT_P05_FIX_REPORT_v1.json')));
  assert.ok(existsSync(join(CALIBRATION, 'CG_PILOT_FRESH_8OF8_RERUN_REPORT_v1.json')));
});

test('closure explicitly excludes deferred work from pilot gate', () => {
  const closure = readJson('CG_PRODUCTION_NORMALIZATION_PILOT_CLOSURE_v1.json');
  const notAuth = closure.explicitlyNotAuthorized as string[];

  assert.ok(notAuth.some((item) => item.includes('FlexWash production normalization')));
  assert.ok(notAuth.some((item) => item.includes('70-manual')));
  assert.ok(notAuth.some((item) => item.includes('architecture_exception')));
  assert.ok(notAuth.some((item) => item.includes('Production UI')));
});

test('frozen canonical hashes unchanged at pilot closure', () => {
  const registry = readJson('frozen_canonical_hashes_v1.json');
  const frozen = registry.frozenOntologies as Record<string, { file: string; hash: string }>;

  for (const [, entry] of Object.entries(frozen)) {
    assert.equal(sha256File(join(REPO_ROOT, entry.file)), entry.hash);
  }
});
