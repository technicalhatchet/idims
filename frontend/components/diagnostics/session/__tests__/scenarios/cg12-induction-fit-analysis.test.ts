import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const FROZEN_HASH = '0edfd0988fa4f782d946bc7e65089ad018bbb769851be0c6f30a701851e72d54';

test('CG-12 fit analysis records human-approved Outcome A with R1 sufficient for closure', () => {
  const analysis = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG12_INDUCTION_FIT_ANALYSIS_v1.json'), 'utf8'),
  );
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG12_INDUCTION_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  assert.equal(analysis.status, 'human_boundary_approved');
  assert.equal(analysis.humanBoundaryApprovalRequired, true);
  assert.equal(analysis.humanBoundaryApprovedAt, '2026-09-16T19:26:00+00:00');
  assert.equal(analysis.humanBoundaryApprovedOutcome, 'A');
  assert.equal(analysis.recommendedOutcome, 'A');
  assert.equal(analysis.r1SufficientForClosure, true);
  assert.equal(analysis.r2RequiredForClosure, false);
  assert.equal(analysis.r2Required, false);
  assert.equal(analysis.r2Mandatory, false);
  assert.equal(analysis.closureArtifact, 'CG12_INDUCTION_FIT_CLOSURE_v1.json');
  assert.equal(contract.successCriteria.fitAnalysisStatus, 'human_boundary_approved');
  assert.equal(contract.successCriteria.approvedFitOutcome, 'A');
  assert.equal(contract.successCriteria.r1SufficientForClosure, true);
  assert.equal(analysis.canonicalMutationAuthorized, false);
  assert.equal(analysis.canonicalRenameAuthorized, false);
});

test('CG-12 fit analysis separates R1 implementation fit from family-level confidence', () => {
  const analysis = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG12_INDUCTION_FIT_ANALYSIS_v1.json'), 'utf8'),
  );

  const dual = analysis.dualEvaluation;
  assert.equal(dual.r1ImplementationFit.diverges, 0);
  assert.equal(dual.r1ImplementationFit.contractRevisionRequired, false);
  assert.equal(dual.r1ImplementationFit.recommendedOutcome, 'A');
  assert.equal(dual.familyLevelConfidence.crossManufacturerConsistency, 'PENDING — all R1 matrix cells remain PENDING');
  assert.equal(dual.familyLevelConfidence.inductionFamilyStatementAuthorized, false);
  assert.equal(dual.familyLevelConfidence.r2Recommended, false);
  assert.equal(dual.familyLevelConfidence.r2Optional, true);
  assert.equal(analysis.r2OptionalFor, 'cross_manufacturer_consistency_matrix — not required to establish R1 implementation fit');
  assert.equal(analysis.fitOutcomeRecommendation.scope, 'r1_implementation_fit');
});

test('CG-12 fit analysis derives from R1 observation with zero divergences', () => {
  const analysis = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG12_INDUCTION_FIT_ANALYSIS_v1.json'), 'utf8'),
  );
  const obs = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_NE58R9560WS_IR_CG12X_OBSERVATION_v1.json'), 'utf8'),
  );

  assert.equal(analysis.evidenceChain.r1Observation, 'SAMSUNG_NE58R9560WS_IR_CG12X_OBSERVATION_v1.json');
  assert.equal(analysis.classificationSummary.DIVERGES, 0);
  assert.equal(analysis.classificationSummary.INHERITS, obs.classificationHistogram.INHERITS);
  assert.equal(analysis.frozenContractUnderTest.hash, FROZEN_HASH);
  assert.equal(analysis.frozenContractUnderTest.hashMutatedDuringCg12, false);
  assert.equal(analysis.layerDisposition.components.surface_heating_system, 'INHERITS');
  assert.equal(analysis.layerDisposition.instanceScopes.bake_heating_element, 'INHERITS');
  assert.equal(analysis.layerDisposition.instanceScopes.broil_heating_element, 'INHERITS');
});

test('CG-12 fit analysis explains convection_heating_element INHERITS vs CG-11 NO_EVIDENCE', () => {
  const analysis = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG12_INDUCTION_FIT_ANALYSIS_v1.json'), 'utf8'),
  );

  assert.equal(analysis.layerDisposition.conditionalInstanceScopes.convection_heating_element, 'INHERITS');
  assert.equal(analysis.classificationSummary.convectionHeatingElementEvidenced, true);

  const cross = analysis.conditionalConvectionCrossWitness;
  assert.equal(cross.notAContradiction, true);
  assert.equal(cross.witnessComparison.cg11_gas_samsung_nx60.classification, 'NO_EVIDENCE');
  assert.equal(cross.witnessComparison.cg12_induction_samsung_ne58r9560.classification, 'INHERITS');
  assert.ok(cross.contractSemantics.includes('without requiring every implementation to expose it'));
  assert.equal(cross.doesNotRequireCanonicalRevision, true);
});

test('CG-12 governance conclusion does not authorize rename, compounding, or cross-manufacturer claims from R1', () => {
  const analysis = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG12_INDUCTION_FIT_ANALYSIS_v1.json'), 'utf8'),
  );

  const gov = analysis.governanceConclusion;
  assert.ok(gov.statement.includes('functional compatibility of the frozen electric-range ontology with an induction-range implementation'));
  assert.ok(gov.statement.includes('authorize renaming the ontology'));
  assert.equal(gov.canonicalExpansion, 0);
  assert.equal(gov.normalizationCompoundingAuthorized, false);
  assert.ok(gov.doesNotAuthorize.includes('claiming cross-manufacturer induction consistency from R1 alone'));
  assert.ok(gov.doesNotAuthorize.includes('normalization or manufacturer overlay compounding'));

  const centerpiece = analysis.centerpieceFinding;
  assert.equal(centerpiece.id, 'surface_heating_system_induction_functional_equivalence');
  assert.ok(centerpiece.topologyNotCanonical.includes('not promoted to canonical topology'));
});
