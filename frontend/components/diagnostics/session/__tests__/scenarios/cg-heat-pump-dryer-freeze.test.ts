import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import heatPumpDryerOntology from '../../../knowledge/canonical/heat_pump_dryer.json';
import {
  FROZEN_HEAT_PUMP_DRYER_REV1_HASH,
  resolveCanonicalOntologyId,
} from '../../../knowledge/canonical/canonicalRegistry';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANONICAL = resolve(process.cwd(), 'components/diagnostics/knowledge/canonical');

const FROZEN_HASHES = {
  vented_dryer: 'db48a9a1271843fc63d871330c633f468c537fc14242c8d537e611375992b714',
  front_load_washer: '9fed1c36b985f32da8107382cb0cab8e65c509f8cdea7ac72631718b82f99c05',
  top_load_washer: 'dee6b0c7128706eb78ac0e290090cd3d79d98dad579f41d6fa0a36ea3fdbf2b5',
  microwave: '3c9ef98e07c0b87d5f3ea9e313deb21892d75fd563bff397a0cc33aba55e533d',
} as const;

const HP_SPECIFIC = ['heat_pump_thermal_system', 'sealed_moisture_rejection_path'];

const REUSED_VENTED = [
  'door_switch',
  'drive_motor',
  'moisture_sensor',
  'lint_filter',
  'control_board',
  'hmi_control',
  'power_supply',
];

const REJECTED_VENTED_PRIMARY = [
  'heat_source',
  'exhaust_path',
  'heated_airflow_path',
  'thermal_fuse',
];

const REJECTED_HARDWARE = [
  'compressor',
  'evaporator',
  'condenser',
  'expansion_valve',
  'capillary_tube',
  'refrigerant_thermistor',
  'condensate_pump',
  'ipm_inverter',
  'auxiliary_fan',
];

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('heat_pump_dryer.json exists, frozen rev1, locked by freeze artifacts', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_HEAT_PUMP_DRYER_FREEZE_CONTRACT_v1.json'), 'utf8'),
  );
  const lock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_HEAT_PUMP_DRYER_FREEZE_LOCK_v1.json'), 'utf8'),
  );
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_HEAT_PUMP_DRYER_FREEZE_CLOSURE_v1.json'), 'utf8'),
  );

  assert.equal(existsSync(join(CANONICAL, 'heat_pump_dryer.json')), true);
  assert.equal(heatPumpDryerOntology.ontology.frozen, true);
  assert.equal(heatPumpDryerOntology.ontology.frozenRevision, 'rev1');
  assert.equal(contract.successCriteria.humanFreezeApprovalStatus, 'approved');
  assert.equal(lock.verdict, 'CLOSED / HEAT_PUMP_DRYER_ARCHITECTURE_COMPLETE');
  assert.equal(closure.verdict, 'GREEN / HEAT_PUMP_DRYER_FAMILY_FROZEN');
});

test('exactly 2 HP-specific functions and 7 vented_dryer reuse references', () => {
  const componentIds = heatPumpDryerOntology.components.map((c) => c.id);
  assert.equal(componentIds.length, 9);

  for (const id of HP_SPECIFIC) {
    assert.ok(componentIds.includes(id));
  }
  for (const id of REUSED_VENTED) {
    assert.ok(componentIds.includes(id));
  }

  const contract = heatPumpDryerOntology.ontologyContract as {
    reusedFromVentedDryer: { componentIds: string[] };
  };
  assert.equal(contract.reusedFromVentedDryer.componentIds.length, 7);
});

test('vented_dryer primary-path concepts not promoted; refrigeration hardware not canonical', () => {
  const componentIds = new Set(heatPumpDryerOntology.components.map((c) => c.id));

  for (const id of REJECTED_VENTED_PRIMARY) {
    assert.ok(!componentIds.has(id), `vented primary path incorrectly promoted: ${id}`);
  }
  for (const id of REJECTED_HARDWARE) {
    assert.ok(!componentIds.has(id), `hardware incorrectly promoted: ${id}`);
  }

  const notReused = (heatPumpDryerOntology.ontologyContract as {
    explicitlyNotReusedAsPrimaryArchitecture: string[];
  }).explicitlyNotReusedAsPrimaryArchitecture;
  for (const id of REJECTED_VENTED_PRIMARY) {
    assert.ok(notReused.includes(id));
  }
});

test('no hardware refrigeration chain in canonical relationships', () => {
  const rels = heatPumpDryerOntology.relationships;
  const hardwareNodes = new Set(REJECTED_HARDWARE);

  for (const rel of rels) {
    assert.ok(!hardwareNodes.has(rel.from), `hardware in relationship from: ${rel.from}`);
    assert.ok(!hardwareNodes.has(rel.to), `hardware in relationship to: ${rel.to}`);
  }

  const thermalToMoistureRouted = rels.find(
    (r) =>
      r.from === 'heat_pump_thermal_system' &&
      r.to === 'sealed_moisture_rejection_path' &&
      r.type === 'routed_through',
  );
  assert.equal(thermalToMoistureRouted, undefined);
});

test('approved command/enables relationships present', () => {
  const rels = heatPumpDryerOntology.relationships;

  assert.ok(
    rels.some(
      (r) =>
        r.from === 'control_board' &&
        r.to === 'heat_pump_thermal_system' &&
        r.type === 'commands',
    ),
  );
  assert.ok(
    rels.some(
      (r) =>
        r.from === 'control_board' &&
        r.to === 'sealed_moisture_rejection_path' &&
        r.type === 'commands',
    ),
  );
  assert.ok(
    rels.some(
      (r) =>
        r.from === 'door_switch' &&
        r.to === 'heat_pump_thermal_system' &&
        r.type === 'enables',
    ),
  );
  assert.ok(
    rels.some(
      (r) =>
        r.from === 'door_switch' &&
        r.to === 'sealed_moisture_rejection_path' &&
        r.type === 'enables',
    ),
  );
});

test('routed_through thermal→moisture omitted with documented rationale', () => {
  const deferred = (heatPumpDryerOntology as {
    deferredRelationships?: Array<{ status: string; rationale: string }>;
  }).deferredRelationships;
  assert.ok(deferred && deferred.length > 0);
  assert.equal(deferred[0].status, 'omitted_at_freeze');
  assert.ok(deferred[0].rationale.includes('routed_through'));

  const lock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_HEAT_PUMP_DRYER_FREEZE_LOCK_v1.json'), 'utf8'),
  );
  assert.equal(lock.relationshipFreezeDecisions.omitted[0].decision ?? 'OMITTED', 'OMITTED');

  const coupling = heatPumpDryerOntology.functionalDependencies.find(
    (d) => d.id === 'thermal_moisture_functional_coupling',
  );
  assert.ok(coupling);
  assert.ok(String(coupling?.description).includes('Not a physical'));
});

test('prior frozen graph hashes unchanged; heat_pump_dryer hash matches lock', () => {
  assert.equal(sha256File(join(CANONICAL, 'vented_dryer.json')), FROZEN_HASHES.vented_dryer);
  assert.equal(sha256File(join(CANONICAL, 'front_load_washer.json')), FROZEN_HASHES.front_load_washer);
  assert.equal(sha256File(join(CANONICAL, 'top_load_washer.json')), FROZEN_HASHES.top_load_washer);
  assert.equal(sha256File(join(CANONICAL, 'microwave.json')), FROZEN_HASHES.microwave);

  const hpHash = sha256File(join(CANONICAL, 'heat_pump_dryer.json'));
  assert.equal(hpHash, FROZEN_HEAT_PUMP_DRYER_REV1_HASH);
  assert.equal(hpHash, 'd7a98c826d011a9fdef4b8c91ebd4d66ff88629f7d7b91357d43fee42c32d3bb');
});

test('registry resolves heat_pump_dryer; AIO artifacts not mutated', () => {
  assert.equal(resolveCanonicalOntologyId('heat_pump_dryer'), 'heat_pump_dryer');
  assert.equal(resolveCanonicalOntologyId('electric_dryer', 'samsung_hp_dryer_dv22'), 'heat_pump_dryer');
  assert.equal(resolveCanonicalOntologyId('electric_dryer', 'whirlpool_ccu_dryer'), 'vented_dryer');

  const aioCandidate = JSON.parse(
    readFileSync(join(CALIBRATION, 'aio_laundry_combo_functional_contract_candidate_v1.json'), 'utf8'),
  );
  assert.equal(aioCandidate.notCanonicalFile, true);

  const aioStatus = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_AIO_LAUNDRY_COMBO_WORKSTREAM_STATUS_v1.json'), 'utf8'),
  );
  assert.equal(aioStatus.status, 'AIO_FAMILY_FROZEN');
});

test('freeze provenance: zero component promotion and canonical expansion', () => {
  const provenance = heatPumpDryerOntology.freezeProvenance as {
    canonicalExpansion: number;
    componentPromotionCount: number;
    deferredRoutedThroughEdge: { omitted: boolean };
  };
  assert.equal(provenance.canonicalExpansion, 0);
  assert.equal(provenance.componentPromotionCount, 0);
  assert.equal(provenance.deferredRoutedThroughEdge.omitted, true);
});
