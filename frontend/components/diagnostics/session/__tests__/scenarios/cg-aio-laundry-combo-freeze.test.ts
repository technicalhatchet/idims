import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import aioLaundryComboOntology from '../../../knowledge/canonical/aio_laundry_combo.json';
import {
  FROZEN_AIO_LAUNDRY_COMBO_REV1_HASH,
  FROZEN_HEAT_PUMP_DRYER_REV1_HASH,
  resolveCanonicalOntologyId,
} from '../../../knowledge/canonical/canonicalRegistry';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANONICAL = resolve(process.cwd(), 'components/diagnostics/knowledge/canonical');

const FROZEN_SOURCE_HASHES = {
  heat_pump_dryer: 'd7a98c826d011a9fdef4b8c91ebd4d66ff88629f7d7b91357d43fee42c32d3bb',
  front_load_washer: '9fed1c36b985f32da8107382cb0cab8e65c509f8cdea7ac72631718b82f99c05',
  vented_dryer: 'db48a9a1271843fc63d871330c633f468c537fc14242c8d537e611375992b714',
  microwave: '3c9ef98e07c0b87d5f3ea9e313deb21892d75fd563bff397a0cc33aba55e533d',
} as const;

const AIO_OWNED = ['integrated_laundry_orchestration', 'condenser_resistive_dry_heat'];

const COMPOSITION_REFS = [
  'front_load_washer',
  'heat_pump_dryer.sealed_moisture_rejection_path',
  'heat_pump_dryer.heat_pump_thermal_system',
];

const REJECTED_FUNCTIONS = ['sealed_ventless_drying', 'sealed_heat_pump_drying'];

const REJECTED_HARDWARE = [
  'compressor',
  'evaporator',
  'condenser',
  'expansion_valve',
  'capillary_tube',
  'dry_heater',
  'dry_blower',
  'vent_fan',
  'condensate_pump',
  'tco',
  'ntc',
  'ipm',
  'auxiliary_fan',
];

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(CALIBRATION, name), 'utf8'));
}

test('aio_laundry_combo.json exists, frozen rev1, locked by freeze artifacts', () => {
  const contract = readJson('CG_AIO_LAUNDRY_COMBO_FREEZE_CONTRACT_v1.json');
  const lock = readJson('CG_AIO_LAUNDRY_COMBO_FREEZE_LOCK_v1.json');
  const closure = readJson('CG_AIO_LAUNDRY_COMBO_FREEZE_CLOSURE_v1.json');

  assert.equal(existsSync(join(CANONICAL, 'aio_laundry_combo.json')), true);
  assert.equal(aioLaundryComboOntology.ontology.frozen, true);
  assert.equal(aioLaundryComboOntology.ontology.frozenRevision, 'rev1');
  assert.equal(contract.successCriteria.humanFreezeApprovalStatus, 'approved');
  assert.equal(lock.verdict, 'CLOSED / AIO_LAUNDRY_COMBO_ARCHITECTURE_COMPLETE');
  assert.equal(closure.verdict, 'GREEN / AIO_LAUNDRY_COMBO_FAMILY_FROZEN');
});

test('front_load_washer and heat_pump_dryer referenced by composition — not duplicated in components[]', () => {
  const componentIds = aioLaundryComboOntology.components.map((c) => c.id);
  assert.equal(componentIds.length, 2);

  for (const id of AIO_OWNED) {
    assert.ok(componentIds.includes(id));
  }

  const flWashIds = new Set(
    JSON.parse(readFileSync(join(CANONICAL, 'front_load_washer.json'), 'utf8')).components.map(
      (c: { id: string }) => c.id,
    ),
  );
  const hpIds = new Set(
    JSON.parse(readFileSync(join(CANONICAL, 'heat_pump_dryer.json'), 'utf8')).components.map(
      (c: { id: string }) => c.id,
    ),
  );

  for (const id of componentIds) {
    assert.ok(!flWashIds.has(id), `FL washer function duplicated in AIO components: ${id}`);
    assert.ok(!hpIds.has(id), `HP dryer function duplicated in AIO components: ${id}`);
  }

  const refs = aioLaundryComboOntology.compositionReferences.map((r) => r.qualifiedId);
  assert.ok(refs.includes('front_load_washer'));
  assert.ok(refs.includes('heat_pump_dryer.sealed_moisture_rejection_path'));
  assert.ok(refs.includes('heat_pump_dryer.heat_pump_thermal_system'));
});

test('sealed_moisture_rejection_path and heat_pump_thermal_system reused by reference only', () => {
  const refs = aioLaundryComboOntology.compositionReferences;
  const moisture = refs.find(
    (r) => r.qualifiedId === 'heat_pump_dryer.sealed_moisture_rejection_path',
  );
  const hpThermal = refs.find((r) => r.qualifiedId === 'heat_pump_dryer.heat_pump_thermal_system');

  assert.ok(moisture);
  assert.equal(moisture?.duplicatedInComponents, false);
  assert.ok(hpThermal);
  assert.equal(hpThermal?.duplicatedInComponents, false);
  assert.equal(hpThermal?.sourceComponentId, 'heat_pump_thermal_system');
});

test('condenser_resistive_dry_heat exists exactly once as AIO-owned thermal sibling', () => {
  const componentIds = aioLaundryComboOntology.components.map((c) => c.id);
  const matches = componentIds.filter((id) => id === 'condenser_resistive_dry_heat');
  assert.equal(matches.length, 1);

  const hpComponents = JSON.parse(
    readFileSync(join(CANONICAL, 'heat_pump_dryer.json'), 'utf8'),
  ).components.map((c: { id: string }) => c.id);
  assert.ok(!hpComponents.includes('condenser_resistive_dry_heat'));
});

test('integrated_laundry_orchestration is AIO-owned integration — not a washer/dryer dump', () => {
  const orch = aioLaundryComboOntology.components.find(
    (c) => c.id === 'integrated_laundry_orchestration',
  );
  assert.ok(orch);
  assert.equal(orch?.systemId, 'integration');
  assert.ok(String(orch?.note).includes('Not a dump'));
});

test('sealed_ventless_drying and sealed_heat_pump_drying absent from canonical graph', () => {
  const componentIds = new Set(aioLaundryComboOntology.components.map((c) => c.id));
  const refIds = new Set(
    aioLaundryComboOntology.compositionReferences.map((r) => r.qualifiedId),
  );

  for (const rejected of REJECTED_FUNCTIONS) {
    assert.ok(!componentIds.has(rejected));
    assert.ok(!refIds.has(rejected));
  }

  const rejected = aioLaundryComboOntology.ontologyContract.explicitlyRejected as string[];
  assert.ok(rejected.includes('sealed_ventless_drying'));
  assert.ok(
    (aioLaundryComboOntology.freezeProvenance.supersededFunctions as string[]).includes(
      'sealed_heat_pump_drying',
    ),
  );
});

test('no refrigeration or heater/fan/pump hardware promoted to canonical components', () => {
  const componentIds = new Set(aioLaundryComboOntology.components.map((c) => c.id));
  for (const hw of REJECTED_HARDWARE) {
    assert.ok(!componentIds.has(hw), `hardware incorrectly promoted: ${hw}`);
  }

  const overlayIds = (aioLaundryComboOntology.overlayOnlyConcepts as Array<{ id: string }>).map(
    (c) => c.id,
  );
  assert.ok(overlayIds.includes('compressor'));
  assert.ok(overlayIds.includes('dry_heater_element'));
});

test('Samsung WD53 representable without condenser_resistive_dry_heat', () => {
  const scope = aioLaundryComboOntology.platformRealizationScopes.find(
    (p) => p.platformId === 'samsung_laundry_combo',
  );
  assert.ok(scope);
  assert.equal(scope?.dryThermal, 'heat_pump_dryer.heat_pump_thermal_system');
  assert.ok(scope?.doesNotRequire?.includes('condenser_resistive_dry_heat'));
});

test('Whirlpool WFW9620 representable without heat_pump_thermal_system', () => {
  const scope = aioLaundryComboOntology.platformRealizationScopes.find(
    (p) => p.platformId === 'whirlpool_fl_dd_aio',
  );
  assert.ok(scope);
  assert.equal(scope?.dryThermal, 'condenser_resistive_dry_heat');
  assert.ok(scope?.doesNotRequire?.includes('heat_pump_dryer.heat_pump_thermal_system'));
});

test('frozen source graph hashes unchanged; aio hash matches lock and registry', () => {
  for (const [family, expectedHash] of Object.entries(FROZEN_SOURCE_HASHES)) {
    assert.equal(sha256File(join(CANONICAL, `${family}.json`)), expectedHash);
  }

  const aioHash = sha256File(join(CANONICAL, 'aio_laundry_combo.json'));
  assert.equal(aioHash, FROZEN_AIO_LAUNDRY_COMBO_REV1_HASH);
  assert.equal(aioHash, 'be3799a991b3d778b62e60a7ec3d91dfd6fe82432e3f9ac8663d607008081183');

  const lock = readJson('CG_AIO_LAUNDRY_COMBO_FREEZE_LOCK_v1.json');
  assert.equal(lock.canonicalOntology.hash, aioHash);
});

test('registry resolves aio_laundry_combo; existing family routing unchanged', () => {
  assert.equal(resolveCanonicalOntologyId('aio_laundry'), 'aio_laundry_combo');
  assert.equal(resolveCanonicalOntologyId('aio_laundry', 'samsung_laundry_combo'), 'aio_laundry_combo');
  assert.equal(resolveCanonicalOntologyId('washer', 'whirlpool_fl_dd_aio'), 'aio_laundry_combo');

  assert.equal(resolveCanonicalOntologyId('washer', 'whirlpool_fl_dd'), 'front_load_washer');
  assert.equal(resolveCanonicalOntologyId('electric_dryer', 'samsung_hp_dryer_dv22'), 'heat_pump_dryer');
  assert.equal(resolveCanonicalOntologyId('electric_dryer', 'whirlpool_ccu_dryer'), 'vented_dryer');
  assert.equal(resolveCanonicalOntologyId('microwave', 'lg_microwave_otr'), 'microwave');
});

test('freeze provenance: canonical expansion 1, zero component promotion', () => {
  const provenance = aioLaundryComboOntology.freezeProvenance as {
    canonicalExpansion: number;
    componentPromotionCount: number;
    aioOwnedComponents: string[];
    compositionReferences: string[];
  };
  assert.equal(provenance.canonicalExpansion, 1);
  assert.equal(provenance.componentPromotionCount, 0);
  assert.deepEqual(provenance.aioOwnedComponents, AIO_OWNED);
  assert.deepEqual(new Set(provenance.compositionReferences), new Set(COMPOSITION_REFS));
});

test('return closure preserved as historical artifact; workstream status frozen', () => {
  const returnClosure = readJson('CG_AIO_LAUNDRY_COMBO_RETURN_CLOSURE_v1.json');
  assert.equal(returnClosure.discoveryOutcome, 'candidate_ready_for_freeze');
  assert.equal(
    (returnClosure.governanceConclusion as { freezeExecuted: boolean }).freezeExecuted,
    false,
  );

  const status = readJson('CG_AIO_LAUNDRY_COMBO_WORKSTREAM_STATUS_v1.json');
  assert.equal(status.status, 'AIO_FAMILY_FROZEN');
  assert.equal((status.freezeStatus as { state: string }).state, 'COMPLETE');
});
