import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { resolveCanonicalOntologyId } from '../../../knowledge/canonical/canonicalRegistry';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('CG-MICROWAVE-DISCOVERY closed — 7 core + 2 conditional approved for freeze', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_DISCOVERY_CONTRACT_v1.json'), 'utf8'),
  );
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_DISCOVERY_CLOSURE_v1.json'), 'utf8'),
  );
  const candidate = JSON.parse(
    readFileSync(join(CALIBRATION, 'microwave_functional_contract_candidate_v1.json'), 'utf8'),
  );
  const freeze = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FREEZE_CONTRACT_v1.json'), 'utf8'),
  );

  assert.equal(contract.status, 'closed');
  assert.equal(closure.verdict, 'CLOSED / MICROWAVE_FUNCTIONAL_CONTRACT_APPROVED');
  assert.equal(candidate.status, 'approved_for_freeze_preparation');
  assert.equal(candidate.humanDiscoveryReview.status, 'approved');
  assert.equal(closure.approvedFunctionalContract.coreCount, 7);
  assert.equal(closure.approvedFunctionalContract.conditionalCount, 2);
  assert.equal(closure.approvedFunctionalContract.componentPromotionCount, 0);
  assert.equal(freeze.status, 'closed');
  assert.equal(freeze.closureVerdict, 'CLOSED / MICROWAVE_FAMILY_LOCKED');
  assert.equal(resolveCanonicalOntologyId('microwave'), 'microwave');
});

test('HV/RF semantic boundaries preserved — split not merged', () => {
  const candidate = JSON.parse(
    readFileSync(join(CALIBRATION, 'microwave_functional_contract_candidate_v1.json'), 'utf8'),
  );
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_DISCOVERY_CLOSURE_v1.json'), 'utf8'),
  );

  assert.equal(candidate.semanticBoundaries.hv_generation.mergeWithRfCavity, false);
  assert.equal(candidate.semanticBoundaries.rf_cavity.mergeWithHvGeneration, false);
  assert.ok(
    candidate.semanticBoundaries.hv_generation.definition.includes(
      'not the individual HV components',
    ),
  );
  assert.ok(
    candidate.semanticBoundaries.rf_cavity.definition.includes(
      'not a synonym for the physical cavity enclosure',
    ),
  );
  assert.deepEqual(candidate.hvRfCausalChain.chain, [
    'control_board',
    'hv_generation',
    'rf_cavity',
  ]);
  assert.equal(closure.discoveryDecisions.hv_vs_rf_split.includes('KEEP SPLIT'), true);
});

test('thermal_protection single function — no component promotion', () => {
  const candidate = JSON.parse(
    readFileSync(join(CALIBRATION, 'microwave_functional_contract_candidate_v1.json'), 'utf8'),
  );
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_DISCOVERY_CLOSURE_v1.json'), 'utf8'),
  );

  const thermal = candidate.proposedCanonicalFunctions.find(
    (f: { id: string }) => f.id === 'thermal_protection',
  );
  assert.equal(thermal.role, 'core');
  assert.equal(thermal.conditionalInstanceScopesRejected, true);
  assert.equal(candidate.semanticBoundaries.thermal_protection.conditionalInstanceScopes, false);

  assert.ok(candidate.rejectedAsCanonicalNodes.includes('magnetron'));
  assert.ok(candidate.rejectedAsCanonicalNodes.includes('hv_transformer'));
  assert.ok(candidate.rejectedAsCanonicalNodes.includes('individual_tcos'));
  assert.equal(candidate.humanDiscoveryReview.componentPromotionCount, 0);
  assert.equal(closure.governanceConclusion.componentNodesPromoted, 0);
});

test('conditional functions remain conditional — not universal microwave requirements', () => {
  const candidate = JSON.parse(
    readFileSync(join(CALIBRATION, 'microwave_functional_contract_candidate_v1.json'), 'utf8'),
  );

  const sensing = candidate.proposedCanonicalFunctions.find(
    (f: { id: string }) => f.id === 'control_and_sensing',
  );
  assert.equal(sensing.role, 'conditional');
  assert.equal(candidate.semanticBoundaries.control_and_sensing.universality, 'not_asserted');

  const vent = candidate.proposedConditionalFunctions.find(
    (f: { id: string }) => f.id === 'ventilation_otr',
  );
  assert.equal(vent.role, 'conditional');
  assert.equal(vent.conditionalOn, 'otr_configuration');
  assert.equal(candidate.semanticBoundaries.ventilation_otr.universality, 'otr_configuration_only');
});

test('inventory records microwave freeze lock — family locked', () => {
  const inventory = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_CANONICAL_FAMILY_INVENTORY_v1.json'), 'utf8'),
  );
  const freeze = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FREEZE_CONTRACT_v1.json'), 'utf8'),
  );

  assert.equal(
    inventory.microwaveWorkstream.discoveryClosed,
    'CG_MICROWAVE_DISCOVERY_CLOSURE_v1.json',
  );
  assert.equal(
    inventory.microwaveWorkstream.freezeLock,
    'CG_MICROWAVE_FREEZE_LOCK_v1.json',
  );
  assert.ok(inventory.microwaveWorkstream.compoundingClosed);
  assert.ok(inventory.microwaveWorkstream.familyClosureAudit);
  assert.equal(freeze.successCriteria.microwaveFamilyLocked, true);
  assert.equal(freeze.successCriteria.registryRegistered, true);
});
