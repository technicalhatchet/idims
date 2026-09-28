import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { FROZEN_ELECTRIC_RANGE_REV1_HASH } from '../../../knowledge/canonical/canonicalRegistry';
import { resolveDiagnosticGraph } from '../../../knowledge/canonical/resolveDiagnosticGraph';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANONICAL = join(process.cwd(), 'components/diagnostics/knowledge/canonical');

const RANGE_OVEN_HASH =
  'e29bb5fafe2afacdba3b45a1ec8e4ec0b73c78d51ff6319bb6a7c0e20a7b4fc5';

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('CG-RANGE-NY63 compounding sequence 3 is closed with audit GREEN after NE58 S2', () => {
  const compounding = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NY63T8751SS_COMPOUNDING_v1.json'), 'utf8'),
  );
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NY63T8751SS_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );
  const parent = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_COMPOUNDING_v1.json'), 'utf8'),
  );
  const ne58Audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NE58R9560WS_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );

  assert.equal(ne58Audit.verdict, 'GREEN / NE58_COMPOUNDING_AUDIT_PASSED');
  assert.equal(compounding.sequence, 3);
  assert.equal(compounding.status, 'closed');
  assert.equal(audit.verdict, 'GREEN / NY63_COMPOUNDING_AUDIT_PASSED');
  assert.equal(parent.compoundingSequence[2].status, 'closed');
  assert.equal(parent.compoundingSequence[2].overlayFile, 'samsung_range_ny63.json');
});

test('NY63 overlay realizes gas cooktop under surface_heating_system — not dual_fuel canonical', () => {
  const overlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/samsung_range_ny63.json'), 'utf8'),
  );
  const evidence = JSON.parse(
    readFileSync(
      join(CALIBRATION, 'SAMSUNG_NY63T8751SS_RANGE_CG_RANGE_COMPOUNDING_EVIDENCE_v1.json'),
      'utf8',
    ),
  );

  assert.equal(overlay.status, 'published');
  assert.equal(evidence.compoundingCurve.canonicalExpansion, 0);
  assert.ok(evidence.hierarchyTest.surfaceHeatingAbsorbsGasCooktop);
  assert.ok(evidence.hierarchyTest.dualDomainUnderControlBoard);

  const family = overlay.platformFamilies[0];
  const spark = family.functionalRealizations.find(
    (r: { implementation: { platformTerm: string } }) =>
      r.implementation.platformTerm === 'spark_module',
  );
  assert.equal(spark.canonicalLayer, 'surface_heating_system');
  assert.ok(spark.diagnosticEvidence.spec.includes('120 VAC'));

  const bake = family.functionalRealizations.find(
    (r: { canonicalLayer: string; implementation: { platformTerm: string } }) =>
      r.canonicalLayer === 'bake_heating_element' && r.implementation.platformTerm === 'heater_bake',
  );
  assert.ok(bake.diagnosticEvidence.spec.includes('19'));
});

test('NY63 compounding binds all normalized procedures, measurements, and decision branches', () => {
  const overlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/samsung_range_ny63.json'), 'utf8'),
  );
  const normalization = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json'), 'utf8'),
  );

  const family = overlay.platformFamilies[0];
  assert.equal(family.procedureBindings.length, normalization.normalizedProcedures.length);
  assert.equal(family.measurementBindings.length, normalization.normalizedMeasurements.length);
  assert.equal(family.decisionBranchBindings.length, normalization.normalizedDecisionBranches.length);
  assert.equal(normalization.normalizedProcedures.length, 23);
  assert.equal(normalization.normalizedMeasurements.length, 20);
  assert.equal(normalization.provenanceAudit.checks.branchCount, 13);
  assert.equal(overlay.compoundingEvidence.accounting.measurementsBound, 20);
});

test('NY63 dual-fuel hardware in overlay only — canonical contract and prior overlays unchanged', () => {
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NY63T8751SS_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );
  const overlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/samsung_range_ny63.json'), 'utf8'),
  );

  const electricHash = sha256File(join(CANONICAL, 'electric_range.json'));
  const rangeOvenHash = sha256File(join(CANONICAL, 'range_oven.json'));
  assert.equal(electricHash, FROZEN_ELECTRIC_RANGE_REV1_HASH);
  assert.equal(rangeOvenHash, RANGE_OVEN_HASH);
  assert.equal(audit.integrityChecks.nx60OverlayUnmodified, true);
  assert.equal(audit.integrityChecks.ne58OverlayUnmodified, true);

  const ids = overlay.platformFamilies[0].add.components.map((c: { id: string }) => c.id);
  for (const term of ['spark_module', 'valve_cooktop', 'gas_orifice_nozzle', 'heater_bake', 'heater_broil']) {
    assert.ok(ids.includes(term));
  }
  assert.ok(
    overlay.platformFamilies[0].routingRejections.some(
      (r: { conceptId: string }) => r.conceptId === 'dual_fuel_range.json',
    ),
  );
});

test('published NY63 overlay resolves against frozen range_oven for dual_fuel_range template', () => {
  const resolved = resolveDiagnosticGraph({
    templateId: 'dual_fuel_range',
    platformId: 'samsung_range_ny63',
    manufacturer: 'Samsung',
    model: 'NY63T8751SS',
  });

  assert.ok(resolved);
  assert.equal(resolved!.ontology.id, 'range_oven');
  assert.ok(resolved!.components.some((c) => c.id === 'surface_heating_system'));
  assert.ok(resolved!.components.some((c) => c.id === 'spark_module'));
  assert.ok(resolved!.components.some((c) => c.id === 'heater_bake'));
  assert.ok(!resolved!.components.some((c) => c.id === 'bake_heating_element'));
  assert.ok(
    resolved!.procedureBindings?.some((b) => b.procedureId === 'ny63-cooktop-spark-all-burners'),
  );
  assert.ok(
    resolved!.procedureBindings?.some((b) => b.procedureId === 'ny63-c21-abnormal-temp'),
  );
});

test('NY63 sequence 3 audit gate unlocked W11174814 sequence 4 (now closed separately)', () => {
  const ny63Audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NY63T8751SS_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );
  const parent = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_COMPOUNDING_v1.json'), 'utf8'),
  );

  assert.equal(ny63Audit.gateStatus.w11174814CompoundingBlocked, true);
  assert.equal(ny63Audit.gateStatus.nextSequence, 4);
  assert.equal(parent.compoundingSequence[3].status, 'closed');
  assert.equal(parent.compoundingSequence[3].role, 'corroboration');
  assert.equal(parent.exitCriteria.sequencesComplete, '4/4');
});
