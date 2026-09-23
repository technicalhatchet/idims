import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import microwaveOntology from '../../../knowledge/canonical/microwave.json';

const MICROWAVE_FROZEN_HASH =
  '3c9ef98e07c0b87d5f3ea9e313deb21892d75fd563bff397a0cc33aba55e533d';

const RANGE_OVEN_HASH =
  'e29bb5fafe2afacdba3b45a1ec8e4ec0b73c78d51ff6319bb6a7c0e20a7b4fc5';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANONICAL = resolve(process.cwd(), 'components/diagnostics/knowledge/canonical');

const CORE_FUNCTIONS = [
  'power_supply',
  'control_board',
  'user_interface',
  'door_interlock_chain',
  'hv_generation',
  'rf_cavity',
  'thermal_protection',
];

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('CG-MICROWAVE-NORMALIZATION approved — does not mutate microwave.json', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_NORMALIZATION_CONTRACT_v1.json'), 'utf8'),
  );
  const sequence = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_WORKSTREAM_SEQUENCE_v1.json'), 'utf8'),
  );
  const freezeClosure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FREEZE_CLOSURE_v1.json'), 'utf8'),
  );

  assert.equal(contract.workstream, 'CG-MICROWAVE-NORMALIZATION');
  assert.equal(contract.priorPhaseClosed, 'CG_MICROWAVE_FREEZE_CLOSURE_v1.json');
  assert.equal(contract.targetCanonicalIdentity.frozenHash, MICROWAVE_FROZEN_HASH);
  assert.ok(contract.coreConstraint.includes('does not reopen fit/discovery'));
  assert.equal(contract.successCriteria.normalizationAuditStatus, 'approved');
  assert.equal(contract.successCriteria.compoundingWorkstream, 'CG_MICROWAVE_COMPOUNDING_v1.json');
  assert.equal(contract.platformExtensions.length, 2);
  assert.equal(sequence.stopGate.canonicalMutationBlocked, true);
  assert.equal(freezeClosure.governanceConclusion.microwaveFamilyLocked, true);
  assert.equal(microwaveOntology.ontology.frozen, true);
  assert.equal(sha256File(join(CANONICAL, 'microwave.json')), MICROWAVE_FROZEN_HASH);
});

test('normalization targets LG LMHM2237 and Samsung ME11 in order', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_NORMALIZATION_CONTRACT_v1.json'), 'utf8'),
  );

  const order = contract.normalizationOrder.map((e: { targetId: string }) => e.targetId);
  assert.deepEqual(order, ['lg_lmhm2237_otr', 'samsung_me11_otr']);
  assert.equal(contract.targets.length, 2);
  assert.equal(contract.targets[0].manualId, 'LG-LMHM2237-MICROWAVE');
  assert.equal(contract.targets[1].manualId, 'SAMSUNG-ME11-MICROWAVE');
});

test('LG normalization maps HV cascade to hv_generation — magnetron to rf_cavity', () => {
  const lg = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_LG_LMHM2237_NORMALIZATION_v1.json'), 'utf8'),
  );

  assert.equal(lg.status, 'approved');
  assert.equal(lg.canonicalPromotionCount, 0);
  assert.ok(lg.revisionNote.includes('magnetron'));

  const hv = lg.canonicalFunctionalMappings.find(
    (m: { canonicalId: string }) => m.canonicalId === 'hv_generation',
  );
  assert.ok(hv.serviceManualEvidence.notPromotedToCanonical);
  assert.ok(hv.serviceManualEvidence.implementationRealizations.some(
    (r: { term: string }) => r.term === 'hv_transformer',
  ));
  assert.equal(
    hv.serviceManualEvidence.implementationRealizations.some(
      (r: { term: string }) => r.term === 'magnetron',
    ),
    false,
  );

  const rf = lg.canonicalFunctionalMappings.find(
    (m: { canonicalId: string }) => m.canonicalId === 'rf_cavity',
  );
  assert.ok(rf.serviceManualEvidence.implementationRealizations.some(
    (r: { term: string }) => r.term === 'magnetron',
  ));
  assert.ok(rf.serviceManualEvidence.implementationRealizations.some(
    (r: { term: string }) => r.term === 'turntable_motor',
  ));
  assert.deepEqual(lg.implementationRealizationTree.rf_cavity.includes('magnetron'), true);
  assert.deepEqual(lg.implementationRealizationTree.hv_generation.includes('magnetron'), false);

  const componentIds = new Set(microwaveOntology.components.map((c) => c.id));
  assert.equal(componentIds.size, 7);
  for (const id of CORE_FUNCTIONS) {
    assert.ok(componentIds.has(id));
  }
  assert.ok(!componentIds.has('magnetron'));
});

test('normalization audit approved — governance hold resolved via Branch A', () => {
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_NORMALIZATION_AUDIT_v1.json'), 'utf8'),
  );
  const samsung = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_SAMSUNG_ME11_NORMALIZATION_v1.json'), 'utf8'),
  );

  assert.equal(audit.status, 'approved');
  assert.equal(audit.humanNormalizationApprovals.magnetron_rf_cavity, 'APPROVED');
  assert.equal(audit.governanceHold.resolved, true);
  assert.equal(audit.auditChecks.find((c: { id: string }) => c.id === 'magnetron_rf_cavity_realization')?.result, 'pass');
  assert.ok(samsung.implementationRealizationTree.rf_cavity.includes('magnetron'));
  assert.equal(samsung.implementationRealizationTree.hv_generation.includes('magnetron'), false);
});

test('Samsung normalization binds multi-TCO network to thermal_protection and ventilation_otr conditional', () => {
  const samsung = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_SAMSUNG_ME11_NORMALIZATION_v1.json'), 'utf8'),
  );

  const thermal = samsung.canonicalFunctionalMappings.find(
    (m: { canonicalId: string }) => m.canonicalId === 'thermal_protection',
  );
  assert.ok(thermal.serviceManualEvidence.platformTerms.includes('hood_tco'));

  const vent = samsung.canonicalFunctionalMappings.find(
    (m: { canonicalId: string }) => m.canonicalId === 'ventilation_otr',
  );
  assert.equal(vent.microwaveLayer, 'conditionalConcepts[]');
  assert.equal(vent.serviceManualEvidence.conditionalBinding.includes('OTR'), true);
  assert.equal(samsung.canonicalPromotionCount, 0);
});

test('range_oven hash unchanged — normalization contract does not mutate canonicals', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_NORMALIZATION_CONTRACT_v1.json'), 'utf8'),
  );
  const rangeRule = contract.normalizationRules.find(
    (r: { id: string }) => r.id === 'range_oven_untouched',
  );

  assert.equal(sha256File(join(CANONICAL, 'range_oven.json')), RANGE_OVEN_HASH);
  assert.equal(rangeRule.rangeOvenHash, RANGE_OVEN_HASH);
  assert.ok(contract.notCreating.includes('manufacturer overlay compounding'));
});
