import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import microwaveOntology from '../../../knowledge/canonical/microwave.json';
import microwaveReferenceOverlay from '../../../knowledge/canonical/platform_overlays/microwave.reference.json';

const MICROWAVE_FROZEN_HASH =
  '3c9ef98e07c0b87d5f3ea9e313deb21892d75fd563bff397a0cc33aba55e533d';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANONICAL = resolve(process.cwd(), 'components/diagnostics/knowledge/canonical');

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('frozen-metadata governance closed Branch A — compounding authorized', () => {
  const governance = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FROZEN_METADATA_GOVERNANCE_CONTRACT_v1.json'), 'utf8'),
  );
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FROZEN_METADATA_GOVERNANCE_CLOSURE_v1.json'), 'utf8'),
  );
  const sequence = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_WORKSTREAM_SEQUENCE_v1.json'), 'utf8'),
  );
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_NORMALIZATION_AUDIT_v1.json'), 'utf8'),
  );

  assert.equal(governance.status, 'closed');
  assert.equal(governance.verdict, 'GREEN / BRANCH_A_APPROVED');
  assert.equal(closure.humanApproval.branch, 'A_non_authoritative_metadata');
  assert.equal(closure.resolution.microwaveJsonMutated, false);
  assert.equal(closure.documentedException.mustNotPropagateToCompoundedKnowledge, true);
  assert.equal(audit.status, 'approved');
  assert.equal(audit.governanceHold.resolved, true);
  assert.equal(sequence.stopGate.compoundingBlocked, false);

  const metadataPhase = sequence.disciplinedSequence.find(
    (p: { phase: string }) => p.phase === 'CG-MICROWAVE-FROZEN-METADATA-GOVERNANCE',
  );
  assert.equal(metadataPhase?.status, 'closed');
});

test('determination closed with Branch A — stale realizes documented non-authoritative', () => {
  const determination = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_MAGNETRON_REALIZES_DETERMINATION_v1.json'), 'utf8'),
  );

  assert.equal(determination.status, 'closed');
  assert.equal(determination.humanApprovedBranch, 'A_non_authoritative_metadata');
  assert.equal(determination.recommendedBranch, 'A_non_authoritative_metadata');
  assert.equal(determination.evidence.runtimeConsumption.realizesFieldReadByDiagnosticEngine, false);
  assert.equal(determination.branchA.microwaveJsonChangeRequired, false);
});

test('frozen microwave.json retains stale realizes while authoritative layers map magnetron to rf_cavity', () => {
  const magnetronConcept = (microwaveOntology as { overlayOnlyConcepts: { id: string; realizes?: string }[] })
    .overlayOnlyConcepts.find((c) => c.id === 'magnetron');

  assert.equal(magnetronConcept?.realizes, 'hv_generation');
  assert.equal(sha256File(join(CANONICAL, 'microwave.json')), MICROWAVE_FROZEN_HASH);

  const lgPlatform = microwaveReferenceOverlay.platforms.find(
    (p: { platformId: string }) => p.platformId === 'lg_microwave_otr',
  );
  assert.equal(lgPlatform?.componentAliases.magnetron, 'rf_cavity');

  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_NORMALIZATION_CONTRACT_v1.json'), 'utf8'),
  );
  const magnetronRow = contract.implementationRealizationPolicy.mappingTable.find(
    (r: { implementationEvidence: string }) => r.implementationEvidence === 'magnetron',
  );
  assert.equal(magnetronRow?.frozenFunction, 'rf_cavity');
});
