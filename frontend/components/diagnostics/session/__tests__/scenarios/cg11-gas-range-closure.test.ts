import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const EXPECTED_FROZEN_ELECTRIC_HASH =
  '0edfd0988fa4f782d946bc7e65089ad018bbb769851be0c6f30a701851e72d54';

const CALIBRATION = resolve(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const CANONICAL = resolve(process.cwd(), 'components/diagnostics/knowledge/canonical');

function sha256File(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

test('CG-11 closure locks Outcome A with zero canonical mutation', () => {
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG11_GAS_RANGE_FIT_CLOSURE_v1.json'), 'utf8'),
  );
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG11_GAS_RANGE_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );
  const analysis = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG11_GAS_RANGE_FIT_ANALYSIS_v1.json'), 'utf8'),
  );

  assert.equal(closure.status, 'closed_successful');
  assert.equal(closure.verdict, 'CLOSED / GAS_FITS_ELECTRIC_CONTRACT');
  assert.equal(contract.status, 'closed');
  assert.equal(contract.closureArtifact, 'CG11_GAS_RANGE_FIT_CLOSURE_v1.json');
  assert.equal(contract.closureVerdict, 'CLOSED / GAS_FITS_ELECTRIC_CONTRACT');
  assert.equal(contract.approvedFitOutcome, 'A');
  assert.equal(analysis.status, 'human_boundary_approved');
  assert.equal(analysis.humanBoundaryApprovedOutcome, 'A');
  assert.equal(analysis.humanBoundaryApprovedAt, '2026-09-16T15:49:00+00:00');

  assert.equal(closure.headlineMetrics.canonicalExpansion, 0);
  assert.equal(closure.headlineMetrics.canonicalHashMutationsDuringCg11, 0);
  assert.equal(closure.headlineMetrics.classificationDiverges, 0);
  assert.equal(closure.headlineMetrics.gasHardwarePromotedToCanonical, false);
  assert.equal(closure.approvedFitOutcome.outcome, 'A');
  assert.equal(closure.approvedFitOutcome.approvalIsNotCanonicalMutation, true);
  assert.equal(closure.approvedFitOutcome.approvalIsNotOntologyRename, true);
});

test('CG-11 closure preserves frozen electric_range hash and governance boundaries', () => {
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG11_GAS_RANGE_FIT_CLOSURE_v1.json'), 'utf8'),
  );

  const hash = sha256File(join(CANONICAL, 'electric_range.json'));
  assert.equal(hash, EXPECTED_FROZEN_ELECTRIC_HASH);
  assert.equal(closure.frozenContractUnderTest.hashAtCg11Close, EXPECTED_FROZEN_ELECTRIC_HASH);
  assert.equal(closure.frozenContractUnderTest.hashMutatedDuringCg11, false);
  assert.equal(closure.byteStabilityProof.canonicalHashAtCg11Close, EXPECTED_FROZEN_ELECTRIC_HASH);

  const gov = closure.governanceConclusion;
  assert.ok(
    gov.statement.includes('functional compatibility of the frozen electric-range ontology with a gas-range implementation'),
  );
  assert.equal(gov.ontologyRenameAuthorized, false);
  assert.equal(gov.canonicalExpansion, 0);

  assert.ok(
    closure.postClosureInvariants.some((inv: string) =>
      inv.includes('electric_range → range_oven rename is deferred'),
    ),
  );
  assert.ok(
    closure.postClosureInvariants.some((inv: string) =>
      inv.includes('gas_range template routing'),
    ),
  );
  assert.equal(closure.hierarchy.nextOrganizationalGate, 'electric_range_to_range_oven_rename');
});

test('CG-11 closure centers bake/broil instance-scope equivalence and NO_EVIDENCE semantics', () => {
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG11_GAS_RANGE_FIT_CLOSURE_v1.json'), 'utf8'),
  );

  const centerpiece = closure.centerpieceFinding;
  assert.equal(centerpiece.id, 'bake_broil_instance_scope_functional_equivalence');
  assert.equal(centerpiece.physicalImplementationDelta.electric, 'control → relay → heating element');
  assert.equal(centerpiece.physicalImplementationDelta.gas, 'control → relay → HSI → gas valve / burner');
  assert.equal(centerpiece.diagnosticStructurePreserved, true);

  const noEvidence = closure.conditionalNoEvidenceSemantics;
  assert.equal(noEvidence.conceptId, 'convection_heating_element');
  assert.equal(noEvidence.classification, 'NO_EVIDENCE');
  assert.ok(noEvidence.engineRule.includes('does not bind the conditional scope'));

  assert.equal(closure.validationProof.evidenceRegression.testsPassing, 18);

  assert.equal(closure.hierarchy.workstreamSequence, 'CG_RANGE_FAMILY_WORKSTREAM_SEQUENCE_v1.json');
  assert.equal(closure.hierarchy.nextDisciplinedStep, 'CG-12 induction_range fit test');
  assert.ok(closure.futureWorkPolicy.disciplinedSequence.includes('CG-12 → CG-13'));
});
