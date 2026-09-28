import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getManufacturerOverlaysForOntology,
  resolveDiagnosticGraph,
} from '../../../knowledge/canonical/resolveDiagnosticGraph';
import frenchDoorRefrigeratorOntology from '../../../knowledge/canonical/french_door_refrigerator.json';

const EXPECTED_CANONICAL_HASH =
  'adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9';

const CALIBRATION_DIR = resolve(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const OVERLAY_DIR = resolve(
  process.cwd(),
  'components/diagnostics/knowledge/canonical/manufacturer_overlays',
);

function sha256File(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

function runCg95RefrigeratorFamilyClosure(): void {
  const familyLock = JSON.parse(
    readFileSync(resolve(CALIBRATION_DIR, 'CG95_REFRIGERATOR_FAMILY_LOCK_v1.json'), 'utf8'),
  );
  const regression = JSON.parse(
    readFileSync(resolve(CALIBRATION_DIR, 'CG95_REFRIGERATOR_REGRESSION_PROOF_v1.json'), 'utf8'),
  );
  const cg95Contract = JSON.parse(
    readFileSync(
      resolve(CALIBRATION_DIR, 'CG9_5_SXS_REFRIGERATOR_COMPOUNDING_CONTRACT_v1.json'),
      'utf8',
    ),
  );
  const cg8Contract = JSON.parse(
    readFileSync(
      resolve(CALIBRATION_DIR, 'CG8_FRENCH_DOOR_COMPOUNDING_CONTRACT_v1.json'),
      'utf8',
    ),
  );

  assert.equal(familyLock.status, 'closed_successful');
  assert.equal(familyLock.verdict, 'CLOSED / FAMILY_ARCHITECTURE_COMPLETE');
  assert.equal(familyLock.headlineMetrics.canonicalExpansionCumulative, 0);
  assert.equal(familyLock.headlineMetrics.architecturalProofOverlays, 6);
  assert.equal(familyLock.headlineMetrics.productionRuntimeOverlays, 7);
  assert.equal(familyLock.headlineMetrics.sideBySideOntologyCreated, false);
  assert.equal(familyLock.headlineMetrics.configurationBoundaryClosed, true);
  assert.equal(cg95Contract.status, 'closed');
  assert.equal(cg8Contract.status, 'closed');
  assert.equal(cg95Contract.closureArtifact, 'CG95_REFRIGERATOR_FAMILY_LOCK_v1.json');

  const canonicalHash = sha256File(
    resolve(process.cwd(), 'components/diagnostics/knowledge/canonical/french_door_refrigerator.json'),
  );
  assert.equal(canonicalHash, EXPECTED_CANONICAL_HASH);
  assert.equal(familyLock.canonicalOntology.hash, EXPECTED_CANONICAL_HASH);
  assert.equal(frenchDoorRefrigeratorOntology.ontology.frozen, true);
  assert.equal(frenchDoorRefrigeratorOntology.ontology.frozenRevision, 'rev1');

  const proofOverlays = [
    ...familyLock.proofMatrix.configurations[0].overlays,
    ...familyLock.proofMatrix.configurations[1].overlays,
  ];
  assert.equal(proofOverlays.length, 6);

  const recordedHashes = familyLock.byteStabilityProof.overlayHashesAtClosure as Record<
    string,
    string
  >;
  for (const [filename, expectedHash] of Object.entries(recordedHashes)) {
    assert.equal(sha256File(resolve(OVERLAY_DIR, filename)), expectedHash);
    assert.equal(regression.overlayHashesAtClosure[filename], expectedHash);
  }

  const overlays = getManufacturerOverlaysForOntology('french_door_refrigerator');
  assert.equal(overlays.length, 7);
  assert.deepEqual(
    new Set(overlays.map((overlay) => overlay.manufacturer)),
    new Set(['Whirlpool', 'Samsung', 'LG', 'Midea']),
  );

  for (const overlay of overlays) {
    assert.equal(overlay.status, 'published');
    assert.equal(overlay.canonicalOntologyId, 'french_door_refrigerator');
  }

  const jazzResolved = resolveDiagnosticGraph({
    templateId: 'refrigerator',
    manufacturer: 'Whirlpool',
    model: 'WRF535SW',
    platformId: 'whirlpool_jazz_french_door',
  });
  assert.ok(jazzResolved);
  assert.equal(jazzResolved.resolution.canonicalOntologyId, 'french_door_refrigerator');

  const lgSxsResolved = resolveDiagnosticGraph({
    templateId: 'refrigerator',
    manufacturer: 'LG',
    model: 'LSC27926ST',
    platformId: 'lg_sxs',
  });
  assert.ok(lgSxsResolved);
  assert.equal(lgSxsResolved.resolution.platformId, 'lg_sxs');
  assert.ok(
    !lgSxsResolved.procedureBindings.some((b) => b.procedureId?.startsWith('lglrmvs-')),
  );

  const mideaResolved = resolveDiagnosticGraph({
    templateId: 'refrigerator',
    manufacturer: 'Insignia',
    model: 'NS-RSS26SS',
    platformId: 'midea_rss',
  });
  assert.ok(mideaResolved);
  assert.equal(mideaResolved.resolution.platformId, 'midea_rss');

  assert.equal(familyLock.deferredOrganizational.rename, 'french_door_refrigerator → refrigerator');
  assert.equal(
    familyLock.futureWorkPolicy.nextFamilyDiscovery,
    'CG-10 electric range/oven canonical boundary — candidate graph hypothesis to be broken by three independent electric-range manuals',
  );
}

runCg95RefrigeratorFamilyClosure();
console.log('cg95-refrigerator-family-closure: OK');
