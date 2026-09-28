import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
const OVERLAY_DIR = join(CANONICAL, 'manufacturer_overlays');

const RANGE_OVEN_HASH =
  'e29bb5fafe2afacdba3b45a1ec8e4ec0b73c78d51ff6319bb6a7c0e20a7b4fc5';

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('CG-MICROWAVE-FAMILY-CLOSURE is green with family lock and compounding prerequisite closed', () => {
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_CLOSURE_v1.json'), 'utf8'),
  );
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_CLOSURE_AUDIT_v1.json'), 'utf8'),
  );
  const familyLock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_LOCK_v1.json'), 'utf8'),
  );
  const compounding = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_COMPOUNDING_v1.json'), 'utf8'),
  );

  assert.equal(compounding.status, 'closed');
  assert.equal(compounding.exitCriteria.compoundingAuditsGreen, true);
  assert.equal(closure.status, 'closed');
  assert.equal(closure.verdict, 'GREEN / MICROWAVE_FAMILY_CLOSURE_COMPLETE');
  assert.equal(audit.verdict, 'GREEN / MICROWAVE_FAMILY_CLOSURE_AUDIT_PASSED');
  assert.equal(audit.terminalFamilyClosureExecuted, true);
  assert.equal(familyLock.status, 'closed_successful');
  assert.equal(familyLock.verdict, 'CLOSED / MICROWAVE_FAMILY_ARCHITECTURE_COMPLETE');
  assert.equal(familyLock.headlineMetrics.canonicalExpansionCumulative, 0);
});

test('microwave rev1 hash pinned unchanged at family closure', () => {
  const familyLock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_LOCK_v1.json'), 'utf8'),
  );
  const proof = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_CLOSURE_PROOF_v1.json'), 'utf8'),
  );

  const microwaveHash = sha256File(join(CANONICAL, 'microwave.json'));
  assert.equal(microwaveHash, FROZEN_MICROWAVE_REV1_HASH);
  assert.equal(familyLock.canonicalOntology.hash, microwaveHash);
  assert.equal(familyLock.byteStabilityProof.microwaveRev1HashBefore, microwaveHash);
  assert.equal(familyLock.byteStabilityProof.microwaveRev1HashAfter, microwaveHash);
  assert.equal(proof.canonicalOntology.hash, microwaveHash);
  assert.equal(microwaveOntology.ontology.frozen, true);
  assert.equal(sha256File(join(CANONICAL, 'range_oven.json')), RANGE_OVEN_HASH);
});

test('two compounding overlays are published, byte-stable, and resolver-discoverable', () => {
  const familyLock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_LOCK_v1.json'), 'utf8'),
  );
  const proof = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_CLOSURE_PROOF_v1.json'), 'utf8'),
  );

  const recordedHashes = familyLock.byteStabilityProof.overlayHashesAtClosure as Record<
    string,
    string
  >;
  assert.equal(Object.keys(recordedHashes).length, 2);
  assert.equal(familyLock.proofMatrix.witnessSequences.length, 2);
  assert.equal(familyLock.proofMatrix.zeroDeltaPlatformExtensions.length, 2);

  for (const [filename, expectedHash] of Object.entries(recordedHashes)) {
    assert.equal(sha256File(resolve(OVERLAY_DIR, filename)), expectedHash);
    assert.equal(proof.overlayHashesAtClosurePlanning[filename], expectedHash);
  }

  const overlays = getManufacturerOverlaysForOntology('microwave');
  assert.equal(overlays.length, 2);
  for (const overlay of overlays) {
    assert.equal(overlay.status, 'published');
    assert.equal(overlay.canonicalOntologyId, 'microwave');
  }
});

test('provenance chain closed from fit through family closure', () => {
  const familyLock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_LOCK_v1.json'), 'utf8'),
  );
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_CLOSURE_AUDIT_v1.json'), 'utf8'),
  );
  const sequence = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_WORKSTREAM_SEQUENCE_v1.json'), 'utf8'),
  );

  assert.equal(familyLock.provenanceChain.complete, true);
  assert.equal(familyLock.provenanceChain.phases.length, 7);
  assert.ok(familyLock.provenanceChain.phases.every((p: { status: string }) => p.status === 'closed'));
  assert.equal(audit.closureQuestionAnswers.length, 12);
  assert.ok(audit.closureQuestionAnswers.every((q: { status: string }) => q.status === 'green'));
  assert.equal(sequence.status, 'closed');
  assert.equal(sequence.stopGate.workstreamComplete, true);
});

test('CG-MICROWAVE historical artifacts unchanged at family closure', () => {
  const familyLock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_LOCK_v1.json'), 'utf8'),
  );
  const pinned = familyLock.byteStabilityProof.historicalArtifactHashesAtClosure as Record<
    string,
    string
  >;

  for (const [filename, expectedHash] of Object.entries(pinned)) {
    assert.equal(sha256File(join(CALIBRATION, filename)), expectedHash);
  }
});

test('Branch A metadata governance preserved — magnetron rf_cavity at runtime', () => {
  const familyLock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_LOCK_v1.json'), 'utf8'),
  );

  assert.equal(familyLock.branchAMetadataGovernance.authoritativeMapping, 'magnetron → rf_cavity');
  assert.equal(familyLock.branchAMetadataGovernance.preservedAtClosure, true);

  const stale = microwaveOntology.overlayOnlyConcepts?.find((c) => c.id === 'magnetron');
  assert.equal(stale?.realizes, 'hv_generation');

  for (const input of [
    { manufacturer: 'LG', model: 'LMHM2237BD', platformId: 'lg_microwave_otr' },
    { manufacturer: 'Samsung', model: 'ME11A7510DSAA', platformId: 'samsung_microwave_otr' },
  ]) {
    const resolved = resolveDiagnosticGraph({
      templateId: 'microwave',
      ...input,
    });
    const magnetron = resolved!.components.find((c) => c.id === 'magnetron');
    assert.equal(magnetron?.implementsCanonicalId, 'rf_cavity');
  }
});

test('smoke resolve witness and extension model patterns against frozen microwave', () => {
  const smokeCases = [
    { manufacturer: 'LG', model: 'LMHM2237BD', platformId: 'lg_microwave_otr' },
    { manufacturer: 'LG', model: 'LMVM2031ST', platformId: 'lg_microwave_otr' },
    { manufacturer: 'Samsung', model: 'ME11A7510DSAA', platformId: 'samsung_microwave_otr' },
    { manufacturer: 'Samsung', model: 'ME21A706BQN', platformId: 'samsung_microwave_otr' },
  ];

  for (const input of smokeCases) {
    const resolved = resolveDiagnosticGraph({ templateId: 'microwave', ...input });
    assert.ok(resolved, `expected resolve for ${input.model}`);
    assert.equal(resolved!.ontology.id, 'microwave');
    assert.equal(resolved!.resolution.canonicalOntologyId, 'microwave');
  }
});

test('deferred items documented — no canonical scope expansion required', () => {
  const familyLock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_LOCK_v1.json'), 'utf8'),
  );
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_CLOSURE_AUDIT_v1.json'), 'utf8'),
  );

  assert.ok(familyLock.deferredOrganizational.diagramCrops.includes('platform_only'));
  assert.equal(familyLock.futureWorkPolicy.canonicalExpansion, 'requires_separate_ontology_gate');
  assert.ok(familyLock.closureStatement.includes('coverage work'));
  assert.ok(audit.remainingGaps.every((g: { blocksExecution: boolean }) => !g.blocksExecution));
});

test('no fuel-specific or duplicate microwave canonical files created', () => {
  assert.equal(existsSync(join(CANONICAL, 'otr_microwave.json')), false);
  assert.equal(existsSync(join(CANONICAL, 'microwave_rev2.json')), false);
});

test('workstream sequence terminally closed — no pending human gates', () => {
  const sequence = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_WORKSTREAM_SEQUENCE_v1.json'), 'utf8'),
  );

  assert.equal(sequence.verdict, 'GREEN / MICROWAVE_FAMILY_WORKSTREAM_COMPLETE');
  assert.equal(sequence.stopGate.familyClosureComplete, true);
  assert.equal(sequence.stopGate.familyClosureBlocked, false);
  assert.equal(sequence.currentPosition.includes('STOP'), true);
});
