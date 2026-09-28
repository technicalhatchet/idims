import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANONICAL = join(process.cwd(), 'components/diagnostics/knowledge/canonical');
const OVERLAYS = join(CANONICAL, 'manufacturer_overlays');
const EXPECTED_CANONICAL_HASH = 'adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9';
const ARTIFACT = 'SAMSUNG_RS28_SXS_REFRIGERATOR_FAMILY_BOUNDARY_OBSERVATION_v1.json';

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('CG-9 discovery preserves frozen French-door canonical graph', () => {
  const fdPath = join(CANONICAL, 'french_door_refrigerator.json');
  const fd = JSON.parse(readFileSync(fdPath, 'utf8'));
  assert.equal(sha256File(fdPath), EXPECTED_CANONICAL_HASH);
  assert.equal(fd.components.length, 6);
  assert.deepEqual(
    fd.components.map((c: { id: string }) => c.id).sort(),
    [
      'air_damper',
      'control_board',
      'defrost_heater',
      'door_switch',
      'evaporator_fan',
      'user_interface',
    ].sort(),
  );
});

test('CG-9 discovery did not create side-by-side canonical ontology or mutate overlays', () => {
  assert.equal(existsSync(join(CANONICAL, 'side_by_side_refrigerator.json')), false);
  const obs = JSON.parse(readFileSync(join(CALIBRATION, ARTIFACT), 'utf8'));
  for (const file of [
    'whirlpool_jazz_french_door.json',
    'samsung_fridge_bespoke.json',
    'lg_lrmvs.json',
  ]) {
    const live = sha256File(join(OVERLAYS, file));
    assert.equal(live, obs.isolationGuards.priorOverlayHashesObserved[file]);
  }
});

test('CG-9 observation artifact enforces discovery discipline', () => {
  const obs = JSON.parse(readFileSync(join(CALIBRATION, ARTIFACT), 'utf8'));

  assert.equal(obs.canonicalExpansion, 0);
  assert.equal(obs.canonicalMutation, 0);
  assert.equal(obs.freezeReopened, false);
  assert.equal(obs.discoveryCorpusInheritance, 0);
  assert.equal(obs.isolationGuards.cg7DiscoveryCorpusUsedAsInheritance, false);
  assert.equal(obs.isolationGuards.cg8FrenchDoorOverlaysUsedAsEvidence, false);
  assert.equal(obs.isolationGuards.sideBySideCanonicalOntologyCreated, false);
  assert.equal(obs.isolationGuards.manufacturerOverlayPublished, false);

  assert.equal(obs.sixKeepFunctionEvidence.length, 6);
  assert.equal(obs.fiveConditionalFunctionEvidence.length, 5);
  assert.ok(obs.familyBoundaryHypotheses.hypothesisA_shareFrenchDoorOntology);
  assert.ok(obs.familyBoundaryHypotheses.hypothesisC_distinctSideBySideOntology);

  for (const proposal of obs.possibleNewCanonicalFunctions) {
    assert.equal(proposal.inComponentsArray, false);
  }

  const blob = JSON.stringify(obs).toLowerCase();
  assert.ok(!blob.includes('cg7_fd_refrigerator_r3_triangulation'));
  assert.ok(!blob.includes('functional_role_triangulated'));
});

test('CG-9 hypothesis C is contradicted and A is supported by KEEP evidence', () => {
  const obs = JSON.parse(readFileSync(join(CALIBRATION, ARTIFACT), 'utf8'));
  assert.equal(obs.familyBoundaryHypotheses.hypothesisA_shareFrenchDoorOntology.status, 'supported');
  assert.equal(obs.familyBoundaryHypotheses.hypothesisC_distinctSideBySideOntology.status, 'contradicted');
  const sharedKeep = obs.sixKeepFunctionEvidence.filter(
    (r: { disposition: string }) => r.disposition === 'shared_function',
  );
  assert.equal(sharedKeep.length, 6);
});

test('CG-9 R2 Whirlpool probe maps all functions to frozen contract with zero expansion', () => {
  const r2 = JSON.parse(
    readFileSync(join(CALIBRATION, 'W11296289_SXS_REFRIGERATOR_FAMILY_BOUNDARY_OBSERVATION_v1.json'), 'utf8'),
  );
  assert.equal(r2.canonicalExpansion, 0);
  assert.equal(r2.cg8CompoundingPerformed, false);
  assert.equal(r2.outsideContractFindings.length, 0);
  assert.equal(r2.sixKeepFunctionEvidence.length, 6);
  assert.equal(r2.fiveConditionalFunctionEvidence.length, 5);
});

test('CG-9 R2 triangulation closes family boundary without new canonical concepts', () => {
  const tri = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG9_SXS_REFRIGERATOR_FAMILY_BOUNDARY_R2_TRIANGULATION_v1.json'), 'utf8'),
  );
  assert.equal(tri.status, 'family_boundary_closed');
  assert.equal(tri.newCanonicalConcepts, 0);
  assert.equal(tri.familyBoundaryVerdict.familyBoundaryClosed, true);
  assert.equal(tri.familyBoundaryVerdict.hypothesisC_distinctSideBySideOntology, 'falsified');
  assert.equal(tri.crossManufacturerFunctionalIntersection.allKeepFunctionsIntersect, true);
  assert.equal(tri.isolationGuards.cg8OverlaysUsedAsSxSEvidence, false);
  assert.equal(tri.isolationGuards.sideBySideCanonicalOntologyCreated, false);
  assert.equal(tri.frozenContractReference.hash, EXPECTED_CANONICAL_HASH);
});
