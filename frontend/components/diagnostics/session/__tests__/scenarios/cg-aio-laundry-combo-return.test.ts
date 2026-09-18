import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANONICAL = resolve(process.cwd(), 'components/diagnostics/knowledge/canonical');

const FROZEN_HASHES = {
  heat_pump_dryer: 'd7a98c826d011a9fdef4b8c91ebd4d66ff88629f7d7b91357d43fee42c32d3bb',
  front_load_washer: '9fed1c36b985f32da8107382cb0cab8e65c509f8cdea7ac72631718b82f99c05',
  vented_dryer: 'db48a9a1271843fc63d871330c633f468c537fc14242c8d537e611375992b714',
  microwave: '3c9ef98e07c0b87d5f3ea9e313deb21892d75fd563bff397a0cc33aba55e533d',
} as const;

const PERMITTED_OUTCOMES = [
  'candidate_ready_for_freeze',
  'discovery_insufficient',
  'existing_family_can_be_extended',
] as const;

const REJECTED_HARDWARE = [
  'compressor',
  'evaporator',
  'condenser',
  'dry_blower',
  'vent_fan',
  'condensate_pump',
];

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(CALIBRATION, name), 'utf8'));
}

test('AIO return contract active — frozen HP and FL references immutable', () => {
  const contract = readJson('CG_AIO_LAUNDRY_COMBO_RETURN_CONTRACT_v1.json');
  assert.equal(contract.workstream, 'CG-AIO-LAUNDRY-COMBO-RETURN');
  assert.equal(contract.status, 'active');
  assert.ok((contract.notCreating as string[]).includes('aio_laundry_combo.json'));
  assert.equal(
    (contract.resumedFrom as { hpDryerFreezeComplete: boolean }).hpDryerFreezeComplete,
    true,
  );
});

test('frozen canonical graphs unchanged including heat_pump_dryer', () => {
  for (const [family, expectedHash] of Object.entries(FROZEN_HASHES)) {
    assert.equal(sha256File(join(CANONICAL, `${family}.json`)), expectedHash);
  }
});

test('Samsung WD53 and Whirlpool WFW9620 both represented in return triangulation', () => {
  const triangulation = readJson('CG_AIO_LAUNDRY_COMBO_RETURN_TRIANGULATION_v1.json');
  const witnesses = triangulation.witnesses as Array<{ manufacturer: string }>;
  assert.equal(witnesses.length, 2);
  assert.ok(witnesses.some((w) => w.manufacturer === 'Samsung'));
  assert.ok(witnesses.some((w) => w.manufacturer === 'Whirlpool'));
});

test('heat_pump_thermal_system not generalized to Whirlpool condenser-resistive', () => {
  const analysis = readJson('CG_AIO_LAUNDRY_COMBO_RETURN_ANALYSIS_v1.json');
  const thermal = analysis.drySideQuestionAnswers as {
    D_reference_frozen_hp_without_duplication: { w2UsesHpThermal: boolean };
  };
  assert.equal(thermal.D_reference_frozen_hp_without_duplication.w2UsesHpThermal, false);

  const candidate = readJson('aio_laundry_combo_functional_contract_candidate_v1.json');
  const hpRef = (candidate.reusedExistingCanonicalDomains as {
    heatPumpDryer: { functionsReferenced: Array<{ id: string; explicitlyNotFor?: string[] }> };
  }).heatPumpDryer;
  const hpThermal = hpRef.functionsReferenced.find((f) => f.id === 'heat_pump_thermal_system');
  assert.ok(hpThermal?.explicitlyNotFor?.some((s) => s.includes('Whirlpool')));
});

test('sealed_moisture_rejection_path valid shared reference; sealed_ventless_drying parent rejected', () => {
  const triangulation = readJson('CG_AIO_LAUNDRY_COMBO_RETURN_TRIANGULATION_v1.json');
  const moisture = triangulation.moistureRejectionTriangulation as {
    classification: string;
    candidateFunction: string;
  };
  assert.equal(moisture.classification, 'cross_manufacturer_convergent');
  assert.equal(moisture.candidateFunction, 'sealed_moisture_rejection_path');

  const parent = triangulation.sealedVentlessDryingParentEvaluation as {
    classification: string;
  };
  assert.equal(parent.classification, 'rejected_as_canonical_parent');

  const closure = readJson('CG_AIO_LAUNDRY_COMBO_RETURN_CLOSURE_v1.json');
  assert.equal(
    (closure.explicitDispositions as { sealed_ventless_drying: { disposition: string } })
      .sealed_ventless_drying.disposition,
    'rejected',
  );
});

test('revised candidate: orchestration retained; condenser_resistive_dry_heat added; sealed_heat_pump_drying superseded', () => {
  const candidate = readJson('aio_laundry_combo_functional_contract_candidate_v1.json');
  const newFns = (candidate.proposedNewCanonicalFunctions as Array<{ id: string }>).map(
    (f) => f.id,
  );
  assert.equal(candidate.revision, 'return_v1_post_hp_freeze');
  assert.ok(newFns.includes('integrated_laundry_orchestration'));
  assert.ok(newFns.includes('condenser_resistive_dry_heat'));
  assert.ok(!newFns.includes('sealed_heat_pump_drying'));

  const superseded = (candidate.supersededFunctions as Array<{ id: string }>).map((f) => f.id);
  assert.ok(superseded.includes('sealed_heat_pump_drying'));
});

test('no refrigeration or fan/pump hardware promoted in revised candidate', () => {
  const candidate = readJson('aio_laundry_combo_functional_contract_candidate_v1.json');
  const newIds = new Set(
    (candidate.proposedNewCanonicalFunctions as Array<{ id: string }>).map((f) => f.id),
  );
  for (const hw of REJECTED_HARDWARE) {
    assert.ok(!newIds.has(hw));
  }
  const rejected = (candidate.rejectedAsCanonicalPromotion as { implementationComponents: string[] })
    .implementationComponents;
  assert.ok(rejected.includes('compressor'));
  assert.ok(rejected.includes('dry_blower'));
});

test('return closure: candidate_ready_for_freeze — historical artifact before separate freeze gate', () => {
  const closure = readJson('CG_AIO_LAUNDRY_COMBO_RETURN_CLOSURE_v1.json');
  assert.ok((PERMITTED_OUTCOMES as readonly string[]).includes(closure.discoveryOutcome as string));
  assert.equal(closure.discoveryOutcome, 'candidate_ready_for_freeze');
  assert.equal(
    (closure.governanceConclusion as { freezeExecuted: boolean }).freezeExecuted,
    false,
  );
  assert.equal(existsSync(join(CANONICAL, 'aio_laundry_combo.json')), true);
});

test('workstream status: freeze complete; corroboration artifacts preserved', () => {
  const status = readJson('CG_AIO_LAUNDRY_COMBO_WORKSTREAM_STATUS_v1.json');
  assert.equal(status.status, 'AIO_FAMILY_FROZEN');
  assert.equal((status.returnStatus as { state: string }).state, 'COMPLETE');
  assert.equal((status.freezeStatus as { state: string }).state, 'COMPLETE');
  assert.equal((status.corroborationStatus as { state: string }).state, 'COMPLETE');

  const corroboration = readJson('CG_AIO_LAUNDRY_COMBO_CORROBORATION_v1.json');
  assert.equal(corroboration.candidateModified, false);
});
