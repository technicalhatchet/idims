import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { FROZEN_ELECTRIC_RANGE_REV1_HASH } from '../../../knowledge/canonical/canonicalRegistry';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANONICAL = join(process.cwd(), 'components/diagnostics/knowledge/canonical');

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('CG_RANGE_W11174814_NORMALIZATION is corroboration-only under range_oven', () => {
  const w11174814 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_W11174814_NORMALIZATION_v1.json'), 'utf8'),
  );
  const parent = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NORMALIZATION_v1.json'), 'utf8'),
  );

  assert.equal(w11174814.status, 'normalized');
  assert.equal(w11174814.role, 'corroboration');
  assert.equal(w11174814.notRetroactiveFitEvidence, true);
  assert.equal(w11174814.canonicalOntologyId, 'range_oven');
  assert.equal(w11174814.evidenceLineageGuardrail.fitEvidenceReference, null);
  assert.equal(parent.targets[3].status, 'normalized');
  assert.equal(
    parent.targets[3].normalizationArtifact,
    'CG_RANGE_W11174814_NORMALIZATION_v1.json',
  );
  assert.equal(parent.exitCriteria.allTargetsNormalized, true);
});

test('W11174814 covers four fuel implementation slices without reopening CG-10–13', () => {
  const w11174814 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_W11174814_NORMALIZATION_v1.json'), 'utf8'),
  );

  assert.ok(w11174814.fuelImplementationSlices.electric_radiant);
  assert.ok(w11174814.fuelImplementationSlices.induction);
  assert.ok(w11174814.fuelImplementationSlices.gas);
  assert.ok(w11174814.fuelImplementationSlices.dual_fuel);
  assert.equal(w11174814.corroborationPolicy.notRetroactiveFitEvidence, true);
  assert.ok(w11174814.corroborationPolicy.doesNotReopen.includes('CG-12'));
  assert.ok(
    w11174814.corroborationPolicy.samsungNormalizationWitnesses.includes(
      'CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json',
    ),
  );
});

test('W11174814 maps multi-brand coverage and canonical layers', () => {
  const w11174814 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_W11174814_NORMALIZATION_v1.json'), 'utf8'),
  );

  assert.equal(w11174814.modelPlatformCoverage.brands.length, 7);
  assert.equal(w11174814.modelPlatformCoverage.modelCodeKey.I, 'induction');
  assert.equal(w11174814.modelPlatformCoverage.modelCodeKey.D, 'dual_fuel');

  const ids = w11174814.canonicalFunctionalMappings.map(
    (m: { canonicalId: string }) => m.canonicalId,
  );
  assert.ok(ids.includes('surface_heating_system'));
  const surface = w11174814.canonicalFunctionalMappings.find(
    (m: { canonicalId: string }) => m.canonicalId === 'surface_heating_system',
  );
  assert.equal(surface.multiImplementationWitness, true);
});

test('W11174814 measurements retain cross-family specs and provenance', () => {
  const w11174814 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_W11174814_NORMALIZATION_v1.json'), 'utf8'),
  );

  const sensor = w11174814.normalizedMeasurements.find(
    (m: { id: string }) => m.id === 'w11174814-oven-sensor-ohms',
  );
  assert.equal(sensor.expectedRange.normalMin, 1000);
  assert.equal(sensor.expectedRange.normalMax, 1200);
  assert.ok(sensor.corroborationNote.includes('Samsung'));

  const dsi = w11174814.normalizedMeasurements.find(
    (m: { id: string }) => m.id === 'w11174814-dsi-coil-ohms',
  );
  assert.equal(dsi.expectedValue, 216);

  const ceran = w11174814.normalizedMeasurements.find(
    (m: { id: string }) => m.id === 'w11174814-ceran-element-ohms',
  );
  assert.equal(ceran.expectedRange.normalMin, 23);
  assert.equal(ceran.expectedRange.normalMax, 83);
});

test('W11174814 excludes platform hardware and accessories from canonical promotion', () => {
  const w11174814 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_W11174814_NORMALIZATION_v1.json'), 'utf8'),
  );
  const excluded = w11174814.excludedFromCanonicalPromotion.map(
    (e: { term: string }) => e.term,
  );

  for (const term of [
    'warming_drawer_element',
    'ipc_induction_power_control',
    'dsi_board',
    'infinite_switch',
    'ceran_element',
    'whirlpool_freestanding_range.json',
  ]) {
    assert.ok(excluded.includes(term));
  }

  assert.equal(w11174814.corroborationFindings.noCanonicalExpansionRequired, true);
});

test('W11174814 provenance audit passes with zero canonical mutation', () => {
  const w11174814 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_W11174814_NORMALIZATION_v1.json'), 'utf8'),
  );

  assert.equal(w11174814.provenanceAudit.status, 'passed');
  assert.equal(w11174814.provenanceAudit.checks.procedureCount, 26);
  assert.equal(w11174814.provenanceAudit.checks.notRetroactiveFitEvidence, true);
  assert.equal(w11174814.provenanceAudit.checks.cg10Through13NotReopened, true);
  assert.equal(w11174814.provenanceAudit.checks.fuelSliceCoverage.induction, true);
  assert.equal(w11174814.definitionOfDone.met, true);

  const hash = sha256File(join(CANONICAL, 'electric_range.json'));
  assert.equal(hash, FROZEN_ELECTRIC_RANGE_REV1_HASH);
  assert.equal(w11174814.provenanceAudit.canonicalIntegrity.newCanonicalOntologyFiles, 0);
});
