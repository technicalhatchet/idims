import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const FROZEN_HASH = '0edfd0988fa4f782d946bc7e65089ad018bbb769851be0c6f30a701851e72d54';

test('CG-11 fit analysis records human-approved Outcome A', () => {
  const analysis = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG11_GAS_RANGE_FIT_ANALYSIS_v1.json'), 'utf8'),
  );
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG11_GAS_RANGE_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  assert.equal(analysis.status, 'human_boundary_approved');
  assert.equal(analysis.humanBoundaryApprovalRequired, true);
  assert.equal(analysis.humanBoundaryApprovedAt, '2026-09-16T15:49:00+00:00');
  assert.equal(analysis.humanBoundaryApprovedOutcome, 'A');
  assert.equal(analysis.recommendedOutcome, 'A');
  assert.equal(analysis.closureArtifact, 'CG11_GAS_RANGE_FIT_CLOSURE_v1.json');
  assert.equal(analysis.r2Required, false);
  assert.equal(contract.successCriteria.fitAnalysisStatus, 'human_boundary_approved');
  assert.equal(contract.successCriteria.approvedFitOutcome, 'A');
  assert.equal(analysis.canonicalMutationAuthorized, false);
  assert.equal(analysis.canonicalRenameAuthorized, false);
});

test('CG-11 fit analysis derives from R1 observation with zero divergences', () => {
  const analysis = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG11_GAS_RANGE_FIT_ANALYSIS_v1.json'), 'utf8'),
  );
  const obs = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_NX60_RANGE_gr_cg11x_observation_v1.json'), 'utf8'),
  );

  assert.equal(analysis.evidenceChain.r1Observation, 'SAMSUNG_NX60_RANGE_gr_cg11x_observation_v1.json');
  assert.equal(analysis.classificationSummary.DIVERGES, 0);
  assert.equal(analysis.classificationSummary.INHERITS, obs.classificationHistogram.INHERITS);
  assert.equal(analysis.frozenContractUnderTest.hash, FROZEN_HASH);
  assert.equal(analysis.frozenContractUnderTest.hashMutatedDuringCg11, false);
  assert.equal(analysis.layerDisposition.instanceScopes.bake_heating_element, 'INHERITS');
  assert.equal(analysis.layerDisposition.instanceScopes.broil_heating_element, 'INHERITS');
});

test('CG-11 fit analysis centers bake/broil instance-scope equivalence', () => {
  const analysis = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG11_GAS_RANGE_FIT_ANALYSIS_v1.json'), 'utf8'),
  );

  const centerpiece = analysis.centerpieceFinding;
  assert.equal(centerpiece.id, 'bake_broil_instance_scope_functional_equivalence');
  assert.equal(centerpiece.diagnosticStructurePreserved.bake.separateProcedure, true);
  assert.equal(centerpiece.diagnosticStructurePreserved.broil.separateProcedure, true);
  assert.ok(centerpiece.conclusion.includes('instance-scope'));
  assert.ok(centerpiece.platformVocabularyNotCanonical.includes('igniter'));
});

test('CG-11 fit analysis preserves NO_EVIDENCE semantics for convection_heating_element', () => {
  const analysis = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG11_GAS_RANGE_FIT_ANALYSIS_v1.json'), 'utf8'),
  );

  assert.equal(analysis.layerDisposition.conditionalInstanceScopes.convection_heating_element, 'NO_EVIDENCE');

  const semantics = analysis.conditionalNoEvidenceSemantics;
  assert.equal(semantics.conceptId, 'convection_heating_element');
  assert.ok(semantics.incorrectInterpretations.includes('gas does not support convection'));
  assert.ok(semantics.engineRule.includes('does not bind the conditional scope'));
});

test('CG-11 governance conclusion does not authorize rename or canonical expansion', () => {
  const analysis = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG11_GAS_RANGE_FIT_ANALYSIS_v1.json'), 'utf8'),
  );

  const gov = analysis.governanceConclusion;
  assert.ok(
    gov.statement.includes('functional compatibility of the frozen electric-range ontology with a gas-range implementation'),
  );
  assert.ok(gov.statement.includes('authorize renaming the ontology'));
  assert.equal(gov.canonicalExpansion, 0);
  assert.ok(gov.doesNotAuthorize.includes('automatic rename electric_range → range_oven'));

  const rename = analysis.deferredOrganizationalQuestion;
  assert.equal(rename.id, 'electric_range_to_range_oven_rename');
  assert.equal(rename.authorizedByThisAnalysis, false);
  assert.equal(rename.separateHumanGate, true);
});
