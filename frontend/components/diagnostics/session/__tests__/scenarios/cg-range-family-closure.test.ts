import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import {
  FROZEN_ELECTRIC_RANGE_REV1_HASH,
  getCanonicalOntologyForTemplate,
  resolveCanonicalOntologyId,
} from '../../../knowledge/canonical/canonicalRegistry';
import {
  PRIMARY_RANGE_CANONICAL_ONTOLOGY_ID,
  RANGE_IMPLEMENTATION_TEMPLATE_IDS,
} from '../../../knowledge/canonical/canonicalOntologyAliases';
import {
  getManufacturerOverlaysForOntology,
  resolveDiagnosticGraph,
} from '../../../knowledge/canonical/resolveDiagnosticGraph';
import rangeOvenOntology from '../../../knowledge/canonical/range_oven.json';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANONICAL = join(process.cwd(), 'components/diagnostics/knowledge/canonical');
const OVERLAY_DIR = join(CANONICAL, 'manufacturer_overlays');

const RANGE_OVEN_HASH =
  'e29bb5fafe2afacdba3b45a1ec8e4ec0b73c78d51ff6319bb6a7c0e20a7b4fc5';

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('CG-RANGE-FAMILY-CLOSURE is green with family lock and compounding prerequisite closed', () => {
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_CLOSURE_v1.json'), 'utf8'),
  );
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_CLOSURE_AUDIT_v1.json'), 'utf8'),
  );
  const familyLock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_LOCK_v1.json'), 'utf8'),
  );
  const compounding = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_COMPOUNDING_v1.json'), 'utf8'),
  );

  assert.equal(compounding.status, 'closed');
  assert.equal(compounding.exitCriteria.sequencesComplete, '4/4');
  assert.equal(closure.status, 'closed');
  assert.equal(audit.verdict, 'GREEN / RANGE_FAMILY_CLOSURE_AUDIT_PASSED');
  assert.equal(familyLock.status, 'closed_successful');
  assert.equal(familyLock.verdict, 'CLOSED / RANGE_FAMILY_ARCHITECTURE_COMPLETE');
  assert.equal(familyLock.headlineMetrics.canonicalExpansionCumulative, 0);
});

test('range_oven is finalized identity — electric_range legacy alias and hashes pinned', () => {
  const familyLock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_LOCK_v1.json'), 'utf8'),
  );
  const regression = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_REGRESSION_PROOF_v1.json'), 'utf8'),
  );

  assert.equal(PRIMARY_RANGE_CANONICAL_ONTOLOGY_ID, 'range_oven');
  assert.equal(familyLock.canonicalOntology.primaryId, 'range_oven');
  assert.equal(familyLock.canonicalOntology.legacyAliasId, 'electric_range');

  const electricHash = sha256File(join(CANONICAL, 'electric_range.json'));
  const rangeOvenHash = sha256File(join(CANONICAL, 'range_oven.json'));
  assert.equal(electricHash, FROZEN_ELECTRIC_RANGE_REV1_HASH);
  assert.equal(rangeOvenHash, RANGE_OVEN_HASH);
  assert.equal(familyLock.canonicalOntology.electricRangeRev1Hash, electricHash);
  assert.equal(familyLock.canonicalOntology.rangeOvenOrganizationalHash, rangeOvenHash);
  assert.equal(regression.canonicalOntology.electricRangeRev1Hash, electricHash);
  assert.equal(rangeOvenOntology.ontology.frozen, true);
  assert.equal(rangeOvenOntology.ontology.organizationalLineage?.adoptedFrom, 'electric_range');
});

test('all four range implementation templates route to shared range_oven contract', () => {
  for (const templateId of RANGE_IMPLEMENTATION_TEMPLATE_IDS) {
    assert.equal(resolveCanonicalOntologyId(templateId, 'samsung_range_nx60'), 'range_oven');
    const ontology = getCanonicalOntologyForTemplate(templateId, 'samsung_range_ny63');
    assert.ok(ontology);
    assert.equal(ontology!.ontology.id, 'range_oven');
  }

  for (const filename of ['gas_range.json', 'induction_range.json', 'dual_fuel_range.json']) {
    assert.equal(existsSync(join(CANONICAL, filename)), false);
  }
});

test('four compounding overlays are published, byte-stable, and resolver-discoverable', () => {
  const familyLock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_LOCK_v1.json'), 'utf8'),
  );
  const regression = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_REGRESSION_PROOF_v1.json'), 'utf8'),
  );

  const recordedHashes = familyLock.byteStabilityProof.overlayHashesAtClosure as Record<
    string,
    string
  >;
  assert.equal(Object.keys(recordedHashes).length, 4);
  assert.equal(familyLock.proofMatrix.sequences.length, 4);

  for (const [filename, expectedHash] of Object.entries(recordedHashes)) {
    assert.equal(sha256File(resolve(OVERLAY_DIR, filename)), expectedHash);
    assert.equal(regression.overlayHashesAtClosure[filename], expectedHash);
  }

  const overlays = getManufacturerOverlaysForOntology('range_oven');
  assert.equal(overlays.length, 4);
  for (const overlay of overlays) {
    assert.equal(overlay.status, 'published');
    assert.equal(overlay.canonicalOntologyId, 'range_oven');
  }
});

test('provenance chain closed from CG-10 discovery through compounding', () => {
  const familyLock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_LOCK_v1.json'), 'utf8'),
  );
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_CLOSURE_AUDIT_v1.json'), 'utf8'),
  );

  assert.equal(familyLock.provenanceChain.complete, true);
  assert.equal(familyLock.provenanceChain.phases.length, 8);
  assert.ok(familyLock.provenanceChain.phases.every((p: { status: string }) => p.status === 'closed'));
  assert.equal(audit.summary.provenanceChainComplete, true);
  assert.equal(audit.closureQuestionAnswers.length, 7);
  assert.ok(audit.closureQuestionAnswers.every((q: { status: string }) => q.status === 'green'));
});

test('CG-10–13 historical artifacts unchanged at family closure', () => {
  const familyLock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_LOCK_v1.json'), 'utf8'),
  );
  const pinned = familyLock.byteStabilityProof.historicalArtifactHashesAtClosure as Record<
    string,
    string
  >;

  for (const [filename, expectedHash] of Object.entries(pinned)) {
    assert.equal(sha256File(join(CALIBRATION, filename)), expectedHash);
  }
});

test('smoke resolve each proof-matrix overlay against frozen range_oven', () => {
  const smokeCases = [
    { templateId: 'gas_range', platformId: 'samsung_range_nx60', manufacturer: 'Samsung', model: 'NX60T8311SS' },
    { templateId: 'induction_range', platformId: 'samsung_range_ne58', manufacturer: 'Samsung', model: 'NE58R9560WS' },
    { templateId: 'dual_fuel_range', platformId: 'samsung_range_ny63', manufacturer: 'Samsung', model: 'NY63T8751SS' },
    { templateId: 'gas_range', platformId: 'whirlpool_freestanding_range', manufacturer: 'Whirlpool', model: 'WFG540H0E' },
  ];

  for (const input of smokeCases) {
    const resolved = resolveDiagnosticGraph(input);
    assert.ok(resolved, `expected resolve for ${input.platformId}`);
    assert.equal(resolved!.ontology.id, 'range_oven');
    assert.equal(resolved!.resolution.canonicalOntologyId, 'range_oven');
  }
});

test('deferred accessories documented — no canonical scope expansion required', () => {
  const familyLock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_LOCK_v1.json'), 'utf8'),
  );

  assert.ok(familyLock.deferredOrganizational.warmingDrawerAccessory.includes('platform_only'));
  assert.ok(familyLock.deferredOrganizational.ovenLightAccessory.includes('platform_only'));
  assert.equal(familyLock.futureWorkPolicy.canonicalExpansion, 'requires_separate_ontology_gate');
  assert.ok(familyLock.closureStatement.includes('coverage work'));
});
