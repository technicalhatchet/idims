import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const REPO_ROOT = resolve(process.cwd(), '..');
const CANONICAL = join(process.cwd(), 'components/diagnostics/knowledge/canonical');
const CANDIDATES = join(process.cwd(), 'components/diagnostics/knowledge/normalization/candidates');

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(CALIBRATION, name), 'utf8'));
}

function sha256File(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

test('pilot lock CLOSED GREEN — batch NOT authorized', () => {
  const lock = readJson('CG_PRODUCTION_NORMALIZATION_PILOT_LOCK_v1.json');
  const govLock = readJson('CG_PRODUCTION_INGESTION_GOVERNANCE_LOCK_v1.json');

  assert.equal(lock.verdict, 'CLOSED / PILOT_GATE_GREEN');
  assert.equal((lock.headlineMetrics as { pilotAuthorized: boolean }).pilotAuthorized, true);
  assert.equal((lock.headlineMetrics as { pilotGateClosed: boolean }).pilotGateClosed, true);
  assert.equal(
    (lock.headlineMetrics as { normalizationBatchAuthorized: boolean }).normalizationBatchAuthorized,
    false,
  );
  assert.equal(
    (govLock.headlineMetrics as { normalizationBatchAuthorized: boolean }).normalizationBatchAuthorized,
    false,
  );
});

test('pilot contract — pipeline proving gate, not coverage gate', () => {
  const contract = readJson('CG_PRODUCTION_NORMALIZATION_PILOT_CONTRACT_v1.json');
  const success = contract.pilotSuccessDefinition as {
    summary: string;
    legitimateOutcomes: string[];
    failureModes: string[];
  };

  assert.equal(contract.workstream, 'CG-PRODUCTION-NORMALIZATION-PILOT');
  assert.equal(contract.cohortSize, 8);
  assert.ok(success.summary.includes('≠') || success.summary.toLowerCase().includes('not'));
  assert.ok(success.legitimateOutcomes.some((outcome) => outcome.includes('architecture_exception')));
  assert.ok(success.failureModes.some((mode) => mode.includes('silent')));
  assert.ok(
    (contract.gateCriteria as { notRequired: string[] }).notRequired.some((item) =>
      item.includes('100%'),
    ),
  );
});

test('pilot cohort — eight deliberate stress slots', () => {
  const cohort = readJson('CG_PRODUCTION_NORMALIZATION_PILOT_COHORT_v1.json');
  const slots = cohort.slots as Array<{
    slotId: string;
    stressDimension: string;
    manualId: string;
    readiness: string;
  }>;

  assert.equal(slots.length, 8);
  assert.ok(slots.some((slot) => slot.stressDimension === 'known_canonical_family'));
  assert.ok(slots.some((slot) => slot.stressDimension === 'cross_manufacturer_mapping'));
  assert.ok(slots.some((slot) => slot.stressDimension === 'third_manufacturer_mapping'));
  assert.ok(slots.some((slot) => slot.stressDimension === 'frozen_range_oven'));
  assert.ok(slots.some((slot) => slot.stressDimension === 'implementation_terminology_stress'));
  assert.ok(slots.some((slot) => slot.stressDimension === 'recently_frozen_rich_functional_mapping'));
  assert.ok(slots.some((slot) => slot.stressDimension === 'composition_reference_architecture'));
  assert.ok(slots.some((slot) => slot.stressDimension === 'architecture_exception_stop'));

  const p03 = slots.find((slot) => slot.slotId === 'P03');
  assert.equal(p03?.readiness, 'ready');
  assert.equal(p03?.manualId, 'LG-FL-WASHER');

  const p08 = slots.find((slot) => slot.slotId === 'P08');
  assert.equal(p08?.manualId, 'SAMSUNG-FLEXWASH-WASHER');
});

test('pilot lifecycle branches defined in contract', () => {
  const contract = readJson('CG_PRODUCTION_NORMALIZATION_PILOT_CONTRACT_v1.json');
  const branches = (contract.pipelineLifecycle as { canonicalMapBranches: Array<{ id: string }> })
    .canonicalMapBranches;

  const ids = branches.map((branch) => branch.id);
  assert.deepEqual(ids, ['known', 'implementation_specific', 'unresolved', 'architecture_conflict']);
});

test('pilot orchestrator exists and encodes batch STOP on architecture exception', () => {
  const runner = readFileSync(join(REPO_ROOT, 'backend/scripts/run_pilot_batch.py'), 'utf8');
  const engine = readFileSync(
    join(REPO_ROOT, 'backend/scripts/normalization/pilot_batch.py'),
    'utf8',
  );

  assert.ok(runner.includes('normalization.pilot_batch'));
  assert.ok(engine.includes('architecture_exception.json'));
  assert.ok(engine.includes('batchStop'));
  assert.ok(engine.includes('FLEXWASH_MANUAL_ID'));
  assert.ok(engine.includes('STOP'));
});

test('ready cohort slots have normalization candidate artifacts', () => {
  const cohort = readJson('CG_PRODUCTION_NORMALIZATION_PILOT_COHORT_v1.json');
  const slots = cohort.slots as Array<{ manualId: string; readiness: string }>;

  for (const slot of slots.filter((entry) => entry.readiness === 'ready')) {
    const manifestPath = join(CANDIDATES, slot.manualId, 'pipeline_manifest.json');
    assert.ok(existsSync(manifestPath), `${slot.manualId} must have pipeline_manifest.json`);
  }
});

test('prerequisite slots are documented — not silently omitted from cohort', () => {
  const cohort = readJson('CG_PRODUCTION_NORMALIZATION_PILOT_COHORT_v1.json');
  const status = readJson('CG_PILOT_PREREQUISITE_INGESTION_STATUS_v1.json');
  const slots = cohort.slots as Array<{ manualId: string; readiness: string }>;

  const blockedIds = slots
    .filter((slot) => slot.readiness === 'prerequisite_ingestion_required')
    .map((slot) => slot.manualId);

  assert.deepEqual(blockedIds, []);
  assert.equal(status.status, 'complete');
  assert.equal(status.slots.P03.readiness, 'ready');
  assert.equal(status.slots.P05.readiness, 'ready');
  assert.equal(status.slots.P07.readiness, 'ready');
});

test('pilot does not authorize product-configuration canonical graphs', () => {
  for (const graph of ['cooktop.json', 'wall_oven.json', 'standalone_freezer.json', 'stacked_laundry_center.json']) {
    assert.equal(existsSync(join(CANONICAL, graph)), false, `${graph} must not exist`);
  }
});

test('frozen canonical hashes unchanged at pilot authorization', () => {
  const registry = readJson('frozen_canonical_hashes_v1.json');
  const frozen = registry.frozenOntologies as Record<string, { file: string; hash: string }>;

  for (const [ontologyId, entry] of Object.entries(frozen)) {
    const path = join(REPO_ROOT, entry.file);
    assert.equal(sha256File(path), entry.hash, `${ontologyId} hash must match registry`);
  }
});

test('pilot closure GREEN — production batch still not authorized', () => {
  const closure = readJson('CG_PRODUCTION_NORMALIZATION_PILOT_CLOSURE_v1.json');

  assert.equal(closure.status, 'closed');
  assert.equal(closure.authorizesProductionBatch, false);
  assert.equal(closure.verdict, 'GREEN / PILOT_GATE_CLOSED');
  assert.equal(closure.authorizesBatchContract, true);
});

test('prerequisite ingestion — P03/P05/P07 ready, P08 untouched', () => {
  const contract = readJson('CG_PILOT_PREREQUISITE_INGESTION_CONTRACT_v1.json');
  const status = readJson('CG_PILOT_PREREQUISITE_INGESTION_STATUS_v1.json');
  const p03 = readJson('CG_PILOT_P03_INGESTION_COMPLETE_v1.json');
  const p05 = readJson('CG_PILOT_P05_INGESTION_COMPLETE_v1.json');
  const p07 = readJson('CG_PILOT_P07_INGESTION_COMPLETE_v1.json');

  assert.ok(contract.forbiddenActions.some((action: string) => action.includes('P08')));
  assert.equal(status.slots.P03.readiness, 'ready');
  assert.equal(status.slots.P05.readiness, 'ready');
  assert.equal(status.slots.P07.readiness, 'ready');
  assert.equal(p03.slotId, 'P03');
  assert.equal(p03.manualId, 'LG-FL-WASHER');
  assert.equal(p05.manualId, 'SAMSUNG-NE58H-INDUCTION-RANGE');
  assert.equal(p07.ingestionSummary.ontologyId, 'heat_pump_dryer');
  assert.equal(status.p08Untouched, true);
  assert.equal(status.freshPilotRunAuthorized, true);

  const p03Manifest = join(CANDIDATES, 'LG-FL-WASHER', 'pipeline_manifest.json');
  const p05Manifest = join(
    CANDIDATES,
    'SAMSUNG-NE58H-INDUCTION-RANGE',
    'pipeline_manifest.json',
  );
  const p07Manifest = join(CANDIDATES, 'SAMSUNG-HP-DRYER-DV22N', 'pipeline_manifest.json');
  assert.ok(existsSync(p03Manifest));
  assert.ok(existsSync(p05Manifest));
  assert.ok(existsSync(p07Manifest));

  const p03Pipeline = JSON.parse(readFileSync(p03Manifest, 'utf8'));
  const p05Pipeline = JSON.parse(readFileSync(p05Manifest, 'utf8'));
  const p07Pipeline = JSON.parse(readFileSync(p07Manifest, 'utf8'));
  assert.equal(p03Pipeline.ontologyId, 'front_load_washer');
  assert.equal(p05Pipeline.ontologyId, 'range_oven');
  assert.equal(p07Pipeline.ontologyId, 'heat_pump_dryer');
  assert.ok(p03.ingestionSummary.overlayCandidates > 0);

  assert.ok(
    existsSync(
      join(
        CANDIDATES,
        'SAMSUNG-FLEXWASH-WASHER',
        'architecture_exception.json',
      ),
    ),
  );
});
