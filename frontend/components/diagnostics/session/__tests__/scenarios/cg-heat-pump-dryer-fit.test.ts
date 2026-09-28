import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const CANONICAL = resolve(process.cwd(), 'components/diagnostics/knowledge/canonical');

const VENTED_DRYER_HASH =
  'db48a9a1271843fc63d871330c633f468c537fc14242c8d537e611375992b714';

const PERMITTED_OUTCOMES = [
  'proven_variant',
  'architectural_divergence',
  'insufficient_evidence',
] as const;

function sha256File(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(CALIBRATION, name), 'utf8'));
}

test('HP dryer fit contract active — vented_dryer primary target; no WD53 witness', () => {
  const contract = readJson('CG_HEAT_PUMP_DRYER_FIT_TEST_CONTRACT_v1.json');

  assert.equal(contract.workstream, 'CG-HEAT-PUMP-DRYER-FIT-TEST');
  assert.equal(contract.status, 'active');
  assert.ok((contract.notCreating as string[]).includes('heat_pump_dryer.json'));
  assert.ok(
    (contract.priorArchitecturalEvidence as { rule: string }).rule.includes(
      'not use Samsung AIO WD53',
    ),
  );
  assert.equal(
    (contract.frozenContractsUnderTest as Array<{ id: string }>)[0].id,
    'vented_dryer',
  );
});

test('HP dryer witnesses: Samsung DV22N and LG DLHC1455 with independent provenance', () => {
  const samsung = readJson('CG_HPD_DV22N8650_FIT_OBSERVATION_v1.json');
  const lg = readJson('CG_HPD_DLHC1455_FIT_OBSERVATION_v1.json');

  assert.equal(samsung.witnessId, 'W1');
  assert.equal(samsung.dryingArchitecture, 'heat_pump_ventless_condenser');
  assert.equal(
    (samsung.fitAgainstVentedDryer as { verdict: string }).verdict,
    'does_not_fit_without_mutation',
  );

  assert.equal(lg.witnessId, 'W2');
  assert.equal(lg.dryingArchitecture, 'heat_pump_condensation');
  assert.equal(
    (lg.fitAgainstVentedDryer as { verdict: string }).verdict,
    'does_not_fit_without_mutation',
  );
});

test('HP dryer triangulation: cross-manufacturer recurrence', () => {
  const triangulation = readJson('CG_HEAT_PUMP_DRYER_FIT_TRIANGULATION_v1.json');

  assert.equal(triangulation.crossManufacturerTriangulation, true);
  assert.equal(triangulation.witnessCount, 2);
  assert.equal(
    (triangulation.triangulationVerdict as { recommendAnalysisOutcome: string })
      .recommendAnalysisOutcome,
    'architectural_divergence',
  );
  assert.equal(
    (triangulation.aioDependencyReference as { notCountedAsWitness: boolean })
      .notCountedAsWitness,
    true,
  );
});

test('HP dryer fit analysis: architectural_divergence — no heat_pump_dryer.json', () => {
  const analysis = readJson('CG_HEAT_PUMP_DRYER_FIT_ANALYSIS_v1.json');

  assert.ok((PERMITTED_OUTCOMES as readonly string[]).includes(analysis.hardOutcome as string));
  assert.equal(analysis.hardOutcome, 'architectural_divergence');
  assert.equal(
    (analysis.headlineMetrics as { heatPumpDryerJsonCreated: boolean }).heatPumpDryerJsonCreated,
    false,
  );
  assert.equal((analysis.headlineMetrics as { canonicalExpansion: number }).canonicalExpansion, 0);
});

test('HP dryer fit: vented_dryer hash unchanged; fit phase did not create canonical json', () => {
  const analysis = readJson('CG_HEAT_PUMP_DRYER_FIT_ANALYSIS_v1.json');
  assert.equal(
    (analysis.headlineMetrics as { heatPumpDryerJsonCreated: boolean }).heatPumpDryerJsonCreated,
    false,
  );
  assert.equal(sha256File(join(CANONICAL, 'vented_dryer.json')), VENTED_DRYER_HASH);

  const divergence = readJson('CG_HEAT_PUMP_DRYER_FIT_DIVERGENCE_PACKAGE_v1.json');
  assert.equal(divergence.fitOutcome, 'architectural_divergence');
  assert.equal(divergence.status, 'awaiting_human_authorization');
  assert.equal(
    (divergence.humanGateRequest as { doNotReturnToAioAutomatically: boolean })
      .doNotReturnToAioAutomatically,
    true,
  );
});

test('AIO workstream: HP fit historical gate preserved; AIO freeze completed separately', () => {
  const divergence = readJson('CG_HEAT_PUMP_DRYER_FIT_DIVERGENCE_PACKAGE_v1.json');
  assert.equal(
    (divergence.humanGateRequest as { doNotReturnToAioAutomatically: boolean })
      .doNotReturnToAioAutomatically,
    true,
  );

  const status = readJson('CG_AIO_LAUNDRY_COMBO_WORKSTREAM_STATUS_v1.json');
  assert.equal(status.status, 'AIO_FAMILY_FROZEN');
  assert.equal((status.returnStatus as { state: string }).state, 'COMPLETE');
  assert.equal((status.freezeStatus as { state: string }).state, 'COMPLETE');
});
