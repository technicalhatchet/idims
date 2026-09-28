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

test('CG-RANGE-W11174814 compounding sequence 4 is closed with corroboration audit GREEN', () => {
  const compounding = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_W11174814_COMPOUNDING_v1.json'), 'utf8'),
  );
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_W11174814_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );
  const parent = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_COMPOUNDING_v1.json'), 'utf8'),
  );
  const ny63Audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NY63T8751SS_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );

  assert.equal(ny63Audit.verdict, 'GREEN / NY63_COMPOUNDING_AUDIT_PASSED');
  assert.equal(compounding.sequence, 4);
  assert.equal(compounding.role, 'corroboration');
  assert.equal(compounding.notRetroactiveFitEvidence, true);
  assert.equal(compounding.status, 'closed');
  assert.equal(audit.verdict, 'GREEN / W11174814_CORROBORATION_COMPOUNDING_AUDIT_PASSED');
  assert.equal(parent.compoundingSequence[3].status, 'closed');
  assert.equal(parent.status, 'closed');
  assert.equal(parent.exitCriteria.sequencesComplete, '4/4');
});

test('W11174814 corroboration overlay enriches implementation knowledge — not canonical promotion', () => {
  const overlay = JSON.parse(
    readFileSync(
      join(CANONICAL, 'manufacturer_overlays/whirlpool_freestanding_range_w11174814.json'),
      'utf8',
    ),
  );
  const evidence = JSON.parse(
    readFileSync(
      join(CALIBRATION, 'WHIRLPOOL_W11174814_RANGE_CG_RANGE_COMPOUNDING_EVIDENCE_v1.json'),
      'utf8',
    ),
  );

  assert.equal(overlay.compoundingRole, 'corroboration');
  assert.equal(overlay.notRetroactiveFitEvidence, true);
  assert.equal(evidence.compoundingCurve.canonicalExpansion, 0);
  assert.equal(evidence.compoundingCurve.fitArtifactsReopened, 0);
  assert.ok(evidence.hierarchyTest.notRetroactiveFitEvidence);
  assert.ok(evidence.hierarchyTest.cg10Through13Untouched);

  const family = overlay.platformFamilies[0];
  const ipc = family.functionalRealizations.find(
    (r: { implementation: { platformTerm: string } }) =>
      r.implementation.platformTerm === 'ipc_induction_power_control',
  );
  assert.equal(ipc.canonicalLayer, 'surface_heating_system');
  assert.equal(ipc.fuelSlice, 'induction');

  const spark = family.functionalRealizations.find(
    (r: { implementation: { platformTerm: string } }) =>
      r.implementation.platformTerm === 'surface_spark_module',
  );
  assert.equal(spark.canonicalLayer, 'surface_heating_system');
});

test('W11174814 compounding binds all normalized procedures, measurements, and decision branches', () => {
  const overlay = JSON.parse(
    readFileSync(
      join(CANONICAL, 'manufacturer_overlays/whirlpool_freestanding_range_w11174814.json'),
      'utf8',
    ),
  );
  const normalization = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_W11174814_NORMALIZATION_v1.json'), 'utf8'),
  );

  const family = overlay.platformFamilies[0];
  assert.equal(family.procedureBindings.length, normalization.normalizedProcedures.length);
  assert.equal(family.measurementBindings.length, normalization.normalizedMeasurements.length);
  assert.equal(family.decisionBranchBindings.length, normalization.normalizedDecisionBranches.length);
  assert.equal(normalization.normalizedProcedures.length, 26);
  assert.equal(normalization.normalizedMeasurements.length, 17);
  assert.equal(normalization.provenanceAudit.checks.branchCount, 12);
  assert.equal(overlay.compoundingEvidence.accounting.measurementsBound, 17);
});

test('W11174814 corroboration does not mutate canonical contract or Samsung overlays', () => {
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_W11174814_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );

  const electricHash = sha256File(join(CANONICAL, 'electric_range.json'));
  const rangeOvenHash = sha256File(join(CANONICAL, 'range_oven.json'));
  assert.equal(electricHash, FROZEN_ELECTRIC_RANGE_REV1_HASH);
  assert.equal(rangeOvenHash, RANGE_OVEN_HASH);
  assert.equal(audit.integrityChecks.nx60OverlayUnmodified, true);
  assert.equal(audit.integrityChecks.ne58OverlayUnmodified, true);
  assert.equal(audit.integrityChecks.ny63OverlayUnmodified, true);
  assert.equal(audit.integrityChecks.cg10Through13FitArtifactsUnmodified, true);
  assert.equal(audit.provenanceChecks.notRetroactiveFitEvidence, true);
});

test('published W11174814 corroboration overlay resolves against frozen range_oven for gas_range', () => {
  const resolved = resolveDiagnosticGraph({
    templateId: 'gas_range',
    platformId: 'whirlpool_freestanding_range',
    manufacturer: 'Whirlpool',
    model: 'WFG540H0E',
  });

  assert.ok(resolved);
  assert.equal(resolved!.ontology.id, 'range_oven');
  assert.ok(resolved!.components.some((c) => c.id === 'surface_heating_system'));
  assert.ok(resolved!.components.some((c) => c.id === 'surface_spark_module'));
  assert.ok(resolved!.components.some((c) => c.id === 'dsi_board'));
  assert.ok(!resolved!.components.some((c) => c.id === 'bake_heating_element'));
  assert.ok(
    resolved!.procedureBindings?.some((b) => b.procedureId === 'w11174426-surface-spark'),
  );
  const overlay = JSON.parse(
    readFileSync(
      join(CANONICAL, 'manufacturer_overlays/whirlpool_freestanding_range_w11174814.json'),
      'utf8',
    ),
  );
  const ipcBinding = overlay.platformFamilies[0].procedureBindings.find(
    (b: { procedureId: string }) => b.procedureId === 'w11174814-induction-ipc-path',
  );
  assert.equal(ipcBinding.fuelSlice, 'induction');
});

test('range compounding workstream STOP gate — family closure unlocks separately', () => {
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_W11174814_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );
  const parent = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_COMPOUNDING_v1.json'), 'utf8'),
  );

  assert.equal(audit.gateStatus.rangeCompoundingSequencesComplete, true);
  assert.equal(audit.gateStatus.sequencesComplete, '4/4');
  assert.equal(audit.gateStatus.familyClosureUnlocked, true);
  assert.equal(audit.gateStatus.nextWorkstream, 'CG-RANGE-FAMILY-CLOSURE');
  assert.ok(parent.nextDisciplinedStep.includes('STOP'));
  assert.ok(parent.nextDisciplinedStep.includes('FAMILY-CLOSURE'));
});
