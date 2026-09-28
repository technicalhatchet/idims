import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import microwaveOntology from '../../../knowledge/canonical/microwave.json';
import rangeOvenOntology from '../../../knowledge/canonical/range_oven.json';
import {
  FROZEN_MICROWAVE_REV1_HASH,
  resolveCanonicalOntologyId,
} from '../../../knowledge/canonical/canonicalRegistry';

const RANGE_OVEN_HASH =
  'e29bb5fafe2afacdba3b45a1ec8e4ec0b73c78d51ff6319bb6a7c0e20a7b4fc5';

const MICROWAVE_REV1_PRE_FREEZE_HASH =
  '5a5e77a73b4d587432bbfd98af0cfcc448f6372469fab479ffb45ea19f1b69ad';

const MICROWAVE_REV1_FROZEN_HASH =
  '3c9ef98e07c0b87d5f3ea9e313deb21892d75fd563bff397a0cc33aba55e533d';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANONICAL = resolve(process.cwd(), 'components/diagnostics/knowledge/canonical');

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const CORE_FUNCTIONS = [
  'power_supply',
  'control_board',
  'user_interface',
  'door_interlock_chain',
  'hv_generation',
  'rf_cavity',
  'thermal_protection',
];

const CONDITIONAL_FUNCTIONS = ['control_and_sensing', 'ventilation_otr'];

const REJECTED_COMPONENT_NODES = [
  'magnetron',
  'hv_transformer',
  'hv_capacitor',
  'hv_diode',
  'hv_fuse',
  'waveguide',
  'waveguide_cover',
  'turntable_motor',
  'humidity_sensor',
];

test('microwave rev1 is frozen and locked by CG_MICROWAVE_FREEZE_LOCK_v1.json', () => {
  const freeze = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FREEZE_CONTRACT_v1.json'), 'utf8'),
  );
  const recommendation = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FREEZE_RECOMMENDATION_v1.json'), 'utf8'),
  );
  const lock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FREEZE_LOCK_v1.json'), 'utf8'),
  );

  assert.equal(microwaveOntology.ontology.frozen, true);
  assert.equal(microwaveOntology.ontology.frozenRevision, 'rev1');
  assert.ok(String(microwaveOntology.ontology.frozenNote).includes('CG_MICROWAVE_FREEZE_LOCK_v1.json'));
  assert.equal(freeze.successCriteria.humanFreezeApprovalStatus, 'approved');
  assert.equal(recommendation.status, 'freeze_approved');
  assert.equal(recommendation.canonicalOntologyFrozen, true);
  assert.equal(recommendation.freezeLockArtifact, 'CG_MICROWAVE_FREEZE_LOCK_v1.json');
  assert.equal(lock.verdict, 'CLOSED / MICROWAVE_ARCHITECTURE_COMPLETE');
});

test('rev1 components[] contains exactly 7 discovery-approved core functions', () => {
  const componentIds = microwaveOntology.components.map((c) => c.id);
  assert.equal(componentIds.length, 7);
  for (const id of CORE_FUNCTIONS) {
    assert.ok(componentIds.includes(id), `missing core function ${id}`);
  }
});

test('conditional functions are not promoted to components[]', () => {
  const componentIds = new Set(microwaveOntology.components.map((c) => c.id));
  const conditionalIds = (
    microwaveOntology as { conditionalConcepts?: Array<{ id: string }> }
  ).conditionalConcepts?.map((c) => c.id) ?? [];

  for (const id of CONDITIONAL_FUNCTIONS) {
    assert.ok(conditionalIds.includes(id));
    assert.ok(!componentIds.has(id), `conditional function incorrectly in components[]: ${id}`);
  }
});

test('no HV/RF component nodes promoted — implementation stays platform-only', () => {
  const componentIds = new Set(microwaveOntology.components.map((c) => c.id));

  for (const id of REJECTED_COMPONENT_NODES) {
    assert.ok(!componentIds.has(id), `rejected component incorrectly in components[]: ${id}`);
  }

  assert.ok(componentIds.has('hv_generation'));
  assert.ok(componentIds.has('rf_cavity'));
  assert.notEqual(componentIds.has('hv_generation') && componentIds.has('rf_cavity'), false);
});

test('hv_generation and rf_cavity remain separate with causal chain encoded', () => {
  const contract = (microwaveOntology as {
    ontologyContract?: { semanticBoundaries?: { hvRfSplit?: string } };
  }).ontologyContract;
  assert.ok(String(contract?.semanticBoundaries?.hvRfSplit).includes('does not authorize merge'));

  const hvRfRel = microwaveOntology.relationships.find(
    (r) => r.from === 'hv_generation' && r.to === 'rf_cavity',
  );
  assert.ok(hvRfRel);

  const controlHvRel = microwaveOntology.relationships.find(
    (r) => r.from === 'control_board' && r.to === 'hv_generation',
  );
  assert.ok(controlHvRel);

  const rfDep = microwaveOntology.functionalDependencies.find((d) => d.id === 'rf_delivery');
  assert.ok(rfDep?.requires?.includes('hv_generation'));
  assert.ok(rfDep?.requires?.includes('rf_cavity'));
});

test('thermal_protection is single canonical function in components[]', () => {
  const thermal = microwaveOntology.components.find((c) => c.id === 'thermal_protection');
  assert.ok(thermal);
  assert.equal(thermal?.type, 'functional_domain');

  const componentIds = new Set(microwaveOntology.components.map((c) => c.id));
  for (const id of ['magnetron_tco', 'cavity_tco', 'hood_tco', 'pcb_thermistor']) {
    assert.ok(!componentIds.has(id));
  }
});

test('frozen hash is deterministic and matches pre-freeze transition', () => {
  const hash = sha256File(join(CANONICAL, 'microwave.json'));
  assert.equal(hash, MICROWAVE_REV1_FROZEN_HASH);
  assert.equal(hash, FROZEN_MICROWAVE_REV1_HASH);

  const recommendation = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FREEZE_RECOMMENDATION_v1.json'), 'utf8'),
  );
  const lock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FREEZE_LOCK_v1.json'), 'utf8'),
  );
  assert.equal(recommendation.canonicalOntology.preFreezeHash, MICROWAVE_REV1_PRE_FREEZE_HASH);
  assert.equal(recommendation.canonicalOntology.frozenHash, MICROWAVE_REV1_FROZEN_HASH);
  assert.equal(lock.canonicalOntology.hashBeforeFreeze, MICROWAVE_REV1_PRE_FREEZE_HASH);
});

test('range_oven unchanged — microwave registered in resolver after freeze lock', () => {
  assert.equal(sha256File(join(CANONICAL, 'range_oven.json')), RANGE_OVEN_HASH);
  assert.equal(rangeOvenOntology.ontology.frozen, true);
  assert.equal(resolveCanonicalOntologyId('microwave'), 'microwave');
  assert.equal(resolveCanonicalOntologyId('microwave', 'lg_microwave_otr'), 'microwave');

  const recommendation = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FREEZE_RECOMMENDATION_v1.json'), 'utf8'),
  );
  assert.equal(recommendation.governanceChecks.rangeOvenHash, RANGE_OVEN_HASH);
  assert.equal(recommendation.canonicalOntology.registryRegistered, true);
});

test('freeze provenance links to discovery closure as sole architectural input', () => {
  const provenance = (microwaveOntology as {
    freezeProvenance?: {
      discoveryClosure?: string;
      sourceCandidate?: string;
      core?: string[];
      conditional?: string[];
      componentPromotionCount?: number;
      hvRfSplitPreserved?: boolean;
      humanFreezeReview?: { status?: string };
      freezeLock?: string;
    };
  }).freezeProvenance;

  assert.equal(provenance?.discoveryClosure, 'CG_MICROWAVE_DISCOVERY_CLOSURE_v1.json');
  assert.equal(provenance?.sourceCandidate, 'microwave_functional_contract_candidate_v1.json');
  assert.deepEqual(provenance?.core, CORE_FUNCTIONS);
  assert.deepEqual(provenance?.conditional, CONDITIONAL_FUNCTIONS);
  assert.equal(provenance?.componentPromotionCount, 0);
  assert.equal(provenance?.hvRfSplitPreserved, true);
  assert.equal(provenance?.humanFreezeReview?.status, 'approved');
  assert.equal(provenance?.freezeLock, 'CG_MICROWAVE_FREEZE_LOCK_v1.json');
});
