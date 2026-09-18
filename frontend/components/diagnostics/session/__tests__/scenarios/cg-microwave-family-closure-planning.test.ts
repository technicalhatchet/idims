import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  FROZEN_MICROWAVE_REV1_HASH,
} from '../../../knowledge/canonical/canonicalRegistry';
import {
  getManufacturerOverlaysForOntology,
  resolveDiagnosticGraph,
} from '../../../knowledge/canonical/resolveDiagnosticGraph';
import microwaveOntology from '../../../knowledge/canonical/microwave.json';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANONICAL = join(process.cwd(), 'components/diagnostics/knowledge/canonical');

const RANGE_OVEN_HASH =
  'e29bb5fafe2afacdba3b45a1ec8e4ec0b73c78d51ff6319bb6a7c0e20a7b4fc5';

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

test('family closure planning completed — terminal closure executed with family lock', () => {
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_CLOSURE_AUDIT_v1.json'), 'utf8'),
  );
  const proof = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_CLOSURE_PROOF_v1.json'), 'utf8'),
  );
  const plan = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_CLOSURE_PLAN_v1.json'), 'utf8'),
  );

  assert.equal(audit.status, 'closed');
  assert.equal(audit.verdict, 'GREEN / MICROWAVE_FAMILY_CLOSURE_AUDIT_PASSED');
  assert.equal(audit.terminalFamilyClosureExecuted, true);
  assert.equal(proof.terminalFamilyClosureExecuted, true);
  assert.equal(plan.familyClosureExecuted, true);
  assert.equal(audit.gateDecision.terminalClosure, 'EXECUTED / MICROWAVE_FAMILY_ARCHITECTURE_COMPLETE');
  assert.equal(existsSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_LOCK_v1.json')), true);
  assert.equal(existsSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_CLOSURE_v1.json')), true);
});

test('frozen microwave rev1 hash stable — range_oven untouched', () => {
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_CLOSURE_AUDIT_v1.json'), 'utf8'),
  );

  assert.equal(sha256File(join(CANONICAL, 'microwave.json')), FROZEN_MICROWAVE_REV1_HASH);
  assert.equal(sha256File(join(CANONICAL, 'range_oven.json')), RANGE_OVEN_HASH);
  assert.equal(audit.integrityChecks.microwaveJsonHash, FROZEN_MICROWAVE_REV1_HASH);
  assert.equal(audit.integrityChecks.rangeOvenJsonHash, RANGE_OVEN_HASH);
  assert.equal(microwaveOntology.ontology.frozen, true);
});

test('canonical expansion zero — compounding workstream closed green', () => {
  const compounding = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_COMPOUNDING_v1.json'), 'utf8'),
  );
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_CLOSURE_AUDIT_v1.json'), 'utf8'),
  );

  assert.equal(compounding.status, 'closed');
  assert.equal(compounding.verdict, 'GREEN / MICROWAVE_COMPOUNDING_COMPLETE');
  assert.equal(compounding.exitCriteria.canonicalExpansion, 0);
  assert.equal(audit.summary.canonicalExpansionCumulative, 0);
  assert.equal(audit.integrityChecks.canonicalExpansionCumulative, 0);
});

test('both overlays registered and resolve independently to frozen microwave graph', () => {
  const overlays = getManufacturerOverlaysForOntology('microwave');
  assert.equal(overlays.length, 2);

  const lg = resolveDiagnosticGraph({
    templateId: 'microwave',
    platformId: 'lg_microwave_otr',
    manufacturer: 'LG',
    model: 'LMHM2237BD',
  });
  const samsung = resolveDiagnosticGraph({
    templateId: 'microwave',
    platformId: 'samsung_microwave_otr',
    manufacturer: 'Samsung',
    model: 'ME11A7510DSAA',
  });

  assert.equal(lg!.ontology.id, 'microwave');
  assert.equal(samsung!.ontology.id, 'microwave');
  for (const fn of CORE_FUNCTIONS) {
    assert.ok(lg!.components.some((c) => c.id === fn));
    assert.ok(samsung!.components.some((c) => c.id === fn));
  }
});

test('magnetron → rf_cavity authoritative — stale hv_generation realizes not propagated', () => {
  const lgOverlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/lg_microwave_otr.json'), 'utf8'),
  );
  const samsungOverlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/samsung_microwave_otr.json'), 'utf8'),
  );
  const stale = microwaveOntology.overlayOnlyConcepts?.find((c) => c.id === 'magnetron');

  assert.equal(stale?.realizes, 'hv_generation');
  for (const overlay of [lgOverlay, samsungOverlay]) {
    const magnetron = overlay.platformFamilies[0].add.components.find(
      (c: { id: string }) => c.id === 'magnetron',
    );
    assert.equal(magnetron.implementsCanonicalId, 'rf_cavity');
    assert.ok(overlay.compoundingEvidence?.accounting?.staleMagnetronRealizesNotPropagated);
  }
});

test('HV cascade hv_generation — door interlock and thermal protection canonical bindings', () => {
  const samsungOverlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/samsung_microwave_otr.json'), 'utf8'),
  );
  const family = samsungOverlay.platformFamilies[0];

  const hvTerms = ['hv_transformer', 'hv_capacitor', 'hv_diode'];
  for (const term of hvTerms) {
    const comp = family.add.components.find((c: { id: string }) => c.id === term);
    assert.equal(comp?.implementsCanonicalId, 'hv_generation');
  }

  const interlock = family.add.components.find((c: { id: string }) => c.id === 'primary_interlock');
  assert.equal(interlock?.implementsCanonicalId, 'door_interlock_chain');

  const tco = family.functionalRealizations.find(
    (r: { implementation: { platformTerm: string } }) =>
      r.implementation.platformTerm === 'four_tco_network',
  );
  assert.equal(tco?.canonicalLayer, 'thermal_protection');
});

test('ventilation_otr conditional on Samsung only — LG does not manufacture conditional', () => {
  const lg = resolveDiagnosticGraph({
    templateId: 'microwave',
    platformId: 'lg_microwave_otr',
    manufacturer: 'LG',
    model: 'LMHM2237BD',
  });
  const samsung = resolveDiagnosticGraph({
    templateId: 'microwave',
    platformId: 'samsung_microwave_otr',
    manufacturer: 'Samsung',
    model: 'ME11A7510DSAA',
  });

  assert.ok(!lg!.components.some((c) => c.id === 'vent_blower_motor'));
  assert.ok(samsung!.components.some((c) => c.id === 'vent_blower_motor'));

  const ventBinding = samsung!.procedureBindings?.find(
    (b) => b.procedureId === 'samsungotrmw-vent-motor',
  );
  assert.ok(ventBinding?.conditionalConcepts?.includes('ventilation_otr'));
});

test('Samsung evidence independent — no LG borrowing', () => {
  const samsungOverlay = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_ME11_MICROWAVE_overlay_mapping_table_v1.json'), 'utf8'),
  );
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_SAMSUNG_ME11_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );

  assert.equal(samsungOverlay.accounting.lgEvidenceBorrowing, 0);
  assert.equal(audit.independenceChecks.allProvenanceFromSamsungNormalization, true);
  assert.ok(audit.independenceChecks.rejectedLgOnlyRealizations.includes('pcb_thermistor'));
});

test('zero-delta platform extensions distinguished from witness compounding', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_NORMALIZATION_CONTRACT_v1.json'), 'utf8'),
  );
  const me21 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_SAMSUNG_ME21_PLATFORM_EXTENSION_v1.json'), 'utf8'),
  );
  const lmvm = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_LG_LMVM_PLATFORM_EXTENSION_v1.json'), 'utf8'),
  );

  assert.equal(contract.platformExtensions.length, 2);
  assert.equal(me21.extensionType, 'platform_model_coverage');
  assert.equal(lmvm.extensionType, 'platform_model_coverage');
  assert.equal(me21.inheritancePolicy.requiresSeparateCompounding, false);
  assert.equal(lmvm.inheritancePolicy.requiresSeparateCompounding, false);
  assert.equal(me21.inheritancePolicy.deltaFunctionalMappings, 0);
  assert.equal(lmvm.inheritancePolicy.deltaFunctionalMappings, 0);

  const witnessIds = contract.targets.map((t: { targetId: string }) => t.targetId);
  assert.deepEqual(witnessIds, ['lg_lmhm2237_otr', 'samsung_me11_otr']);
  assert.ok(!witnessIds.includes('samsung_me21_otr_extension'));
});

test('closure proof answers central question affirmatively — gaps documented', () => {
  const proof = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_CLOSURE_PROOF_v1.json'), 'utf8'),
  );
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_CLOSURE_AUDIT_v1.json'), 'utf8'),
  );

  assert.equal(proof.proofAnswer.startsWith('YES'), true);
  assert.equal(proof.proofMatrix.every((p: { result: string }) => p.result === 'proven'), true);

  assert.equal(proof.organizationalGaps.every((g: { blocksTerminalClosure?: boolean }) => !g.blocksTerminalClosure), true);
  assert.ok(audit.remainingGaps.every((g: { blocksExecution: boolean }) => !g.blocksExecution));
  assert.equal(audit.auditChecks.every((c: { status: string }) => c.status === 'green'), true);
});
