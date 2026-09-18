import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const FROZEN_HASH = '0edfd0988fa4f782d946bc7e65089ad018bbb769851be0c6f30a701851e72d54';

test('CG-13 fit analysis records human-approved Outcome A with R1 sufficient for closure', () => {
  const analysis = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG13_DUAL_FUEL_FIT_ANALYSIS_v1.json'), 'utf8'),
  );
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG13_DUAL_FUEL_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  assert.equal(analysis.status, 'human_boundary_approved');
  assert.equal(analysis.humanBoundaryApprovalRequired, true);
  assert.equal(analysis.humanBoundaryApprovedAt, '2026-09-16T19:56:00+00:00');
  assert.equal(analysis.humanBoundaryApprovedOutcome, 'A');
  assert.equal(analysis.recommendedOutcome, 'A');
  assert.equal(analysis.recommendedOutcomeLabel, 'dual_fuel_fits_electric_contract');
  assert.equal(analysis.closureArtifact, 'CG13_DUAL_FUEL_FIT_CLOSURE_v1.json');
  assert.equal(contract.successCriteria.fitAnalysisStatus, 'human_boundary_approved');
  assert.equal(contract.successCriteria.approvedFitOutcome, 'A');
  assert.equal(analysis.r1SufficientForClosure, true);
  assert.equal(analysis.r2RequiredForClosure, false);
  assert.equal(analysis.canonicalMutationAuthorized, false);
  assert.equal(analysis.canonicalRenameAuthorized, false);
});

test('CG-13 fit analysis separates R1 implementation fit from family-level confidence', () => {
  const analysis = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG13_DUAL_FUEL_FIT_ANALYSIS_v1.json'), 'utf8'),
  );

  const dual = analysis.dualEvaluation;
  assert.equal(dual.r1ImplementationFit.diverges, 0);
  assert.equal(dual.r1ImplementationFit.contractRevisionRequired, false);
  assert.equal(dual.r1ImplementationFit.recommendedOutcome, 'A');
  assert.equal(
    dual.familyLevelConfidence.crossManufacturerConsistency,
    'PENDING — all R1 matrix cells remain PENDING',
  );
  assert.equal(dual.familyLevelConfidence.dualFuelFamilyStatementAuthorized, false);
  assert.equal(dual.familyLevelConfidence.r2Optional, true);
  assert.equal(analysis.fitOutcomeRecommendation.requiresHumanBoundaryApproval, true);
});

test('CG-13 fit analysis derives from R1 observation with zero divergences', () => {
  const analysis = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG13_DUAL_FUEL_FIT_ANALYSIS_v1.json'), 'utf8'),
  );
  const obs = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_NY63T8751SS_DF_CG13X_OBSERVATION_v1.json'), 'utf8'),
  );

  assert.equal(analysis.evidenceChain.r1Observation, 'SAMSUNG_NY63T8751SS_DF_CG13X_OBSERVATION_v1.json');
  assert.equal(analysis.classificationSummary.DIVERGES, 0);
  assert.equal(analysis.classificationSummary.DIVERGES, obs.classificationHistogram.DIVERGES);
  assert.equal(analysis.frozenContractUnderTest.hash, FROZEN_HASH);
  assert.equal(analysis.layerDisposition.components.surface_heating_system, 'INHERITS');
  assert.equal(analysis.layerDisposition.instanceScopes.bake_heating_element, 'INHERITS');
  assert.equal(analysis.layerDisposition.conditionalInstanceScopes.convection_heating_element, 'INHERITS');
  assert.equal(analysis.criticalDualFuelProbeAnswer.falsificationResult, 'no_divergence_observed');
  assert.equal(analysis.centerpieceQuestionAnswer.pendingHumanGate, false);
});

test('CG-13 fit analysis does not authorize canonical gas promotion or dual_fuel ontology', () => {
  const analysis = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG13_DUAL_FUEL_FIT_ANALYSIS_v1.json'), 'utf8'),
  );

  assert.equal(analysis.governanceConclusion.canonicalExpansion, 0);
  assert.equal(analysis.governanceConclusion.canonicalHashMutations, 0);
  assert.ok(analysis.governanceConclusion.doesNotAuthorize.includes('creating dual_fuel_range.json'));
  assert.ok(analysis.governanceConclusion.doesNotAuthorize.includes('promoting gas_valve, spark_module, igniter, burner to canonical'));
  assert.ok(analysis.cumulativeFitContext.experiment.includes('without canonical mutation'));
});
