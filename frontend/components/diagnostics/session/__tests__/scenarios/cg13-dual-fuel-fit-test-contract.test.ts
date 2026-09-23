import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const EXPECTED_FROZEN_ELECTRIC_HASH =
  '0edfd0988fa4f782d946bc7e65089ad018bbb769851be0c6f30a701851e72d54';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const CANONICAL = resolve(process.cwd(), 'components/diagnostics/knowledge/canonical');

function sha256File(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

test('CG-13 fit-test contract is closed with Outcome A and does not create dual_fuel_range.json', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG13_DUAL_FUEL_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  assert.equal(contract.status, 'closed');
  assert.equal(contract.closureVerdict, 'CLOSED / DUAL_FUEL_FITS_ELECTRIC_CONTRACT');
  assert.equal(contract.closureArtifact, 'CG13_DUAL_FUEL_FIT_CLOSURE_v1.json');
  assert.equal(contract.r1SufficientForClosure, true);
  assert.equal(contract.r2RequiredForClosure, false);
  assert.equal(contract.phase, 'CG-13');
  assert.equal(contract.fitTestMode, 'fit_falsification_against_frozen_contract');
  assert.equal(contract.fuelScope, 'dual_fuel_range_only');
  assert.equal(contract.priorPhaseClosed, 'CG12_INDUCTION_FIT_CLOSURE_v1.json');
  assert.equal(contract.priorPhaseVerdict, 'CLOSED / INDUCTION_FITS_ELECTRIC_CONTRACT');
  assert.ok(contract.notCreating.includes('dual_fuel_range.json'));
  assert.ok(contract.notCreating.includes('gas_range.json'));
  assert.ok(contract.notCreating.includes('mutations to electric_range.json'));
  assert.ok(contract.notCreating.includes('automatic promotion of gas_valve'));
  assert.ok(contract.notCreating.includes('automatic promotion of flame_sensor'));
  assert.ok(contract.notCreating.includes('normalization compounding targets'));
  assert.equal(contract.frozenContractUnderTest.immutable, true);
  assert.equal(contract.frozenContractUnderTest.canonicalHashMutationsAllowed, 0);
  assert.equal(contract.successCriteria.canonicalExpansion, 0);
  assert.equal(contract.successCriteria.closureStatus, 'closed_successful');
  assert.equal(contract.successCriteria.r1ObservationStatus, 'complete');
  assert.equal(contract.successCriteria.fitAnalysisStatus, 'human_boundary_approved');
  assert.equal(contract.successCriteria.crossManufacturerMatrixStatus, 'PENDING');
  assert.equal(
    contract.successCriteria.r1ObservationArtifact,
    'SAMSUNG_NY63T8751SS_DF_CG13X_OBSERVATION_v1.json',
  );
  assert.equal(contract.successCriteria.fitAnalysisArtifact, 'CG13_DUAL_FUEL_FIT_ANALYSIS_v1.json');
  assert.equal(contract.fitHypothesisArtifact, 'electric_range_dual_fuel_fit_hypothesis_v1.json');
});

test('CG-13 centerpiece and critical dual-energy-domain probe — not hardware word-matching', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG13_DUAL_FUEL_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  const centerpiece = contract.centerpieceQuestion;
  assert.equal(centerpiece.id, 'dual_fuel_vs_frozen_electric_contract');
  assert.ok(centerpiece.question.includes('gas surface heating with an electric oven'));
  assert.ok(centerpiece.question.includes('without canonical divergence'));
  assert.ok(centerpiece.disallowedShortcut.includes('dual_fuel_range.json'));

  const critical = contract.criticalDualFuelProbe;
  assert.ok(critical.question.includes('functional dependency'));
  assert.ok(critical.notTheQuestion.includes("haven't seen before"));
  assert.equal(critical.functionalArchitectureUnderTest.surfaceDomain.canonicalNode, 'surface_heating_system');
  assert.ok(
    critical.functionalArchitectureUnderTest.ovenDomain.instanceScopes.includes('bake_heating_element'),
  );
  assert.ok(
    critical.functionalArchitectureUnderTest.sharedLayer.includes('control_board'),
  );

  const hypothesis = JSON.parse(
    readFileSync(join(CALIBRATION, 'electric_range_dual_fuel_fit_hypothesis_v1.json'), 'utf8'),
  );
  assert.equal(hypothesis.contract, 'CG13_DUAL_FUEL_FIT_TEST_CONTRACT_v1.json');
  assert.equal(hypothesis.status, 'closed_outcome_a');
  assert.ok(
    hypothesis.criticalDualFuelHypothesis.notBecauseNewHardware.includes('platform vocabulary'),
  );
});

test('CG-13 separates surface gas and oven electric domains with platform vocabulary guard', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG13_DUAL_FUEL_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  const surface = contract.energyDomainProbes.surfaceSide;
  assert.equal(surface.probes[0].frozenContractNode, 'surface_heating_system');
  assert.ok(surface.platformVocabularyGuard.includes('gas_valve'));
  assert.ok(surface.platformVocabularyGuard.includes('flame_sensor'));
  assert.ok(surface.platformVocabularyGuard.includes('hsi'));

  const oven = contract.energyDomainProbes.ovenSide;
  assert.ok(
    oven.probes.some((p: { frozenContractNode: string }) => p.frozenContractNode === 'bake_heating_element'),
  );
  assert.ok(
    oven.probes.some((p: { frozenContractNode: string }) => p.frozenContractNode === 'convection_heating_element'),
  );

  const shared = contract.energyDomainProbes.sharedFunctionalLayer;
  assert.ok(
    shared.probes.some((p: { frozenContractNode: string }) => p.frozenContractNode === 'control_board'),
  );

  const guard = contract.vocabularyGuardrails;
  assert.ok(guard.doNotAutoCreateCanonical.includes('spark_module'));
  assert.ok(guard.ovenElectricRemainsInstanceScopes.includes('broil_heating_element'));
});

test('CG-13 cross-manufacturer matrix and R1-only opening rule', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG13_DUAL_FUEL_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  const matrix = contract.crossManufacturerMatrix;
  assert.equal(matrix.columns.length, 3);
  assert.deepEqual(
    matrix.columns.map((c: { smokeModel: string | null }) => c.smokeModel),
    ['NY63T8751SS/AA', 'LSDL6336F', null],
  );
  assert.equal(matrix.rows.length, 11);
  assert.ok(
    matrix.rows.some(
      (r: { probeId: string; criticalProbe?: boolean }) =>
        r.probeId === 'surface_heating_system_dual_fuel' && r.criticalProbe === true,
    ),
  );
  assert.equal(matrix.status, 'template_pending_observation');

  assert.ok(contract.discoveryCorpus.openingRequirement.includes('not required to open CG-13'));
  assert.equal(contract.discoveryCorpus.R1.observationStatus, 'complete');
  assert.equal(contract.discoveryCorpus.R1.smokeModel, 'NY63T8751SS/AA');
  assert.equal(contract.discoveryCorpus.R1.manualStatus, 'in_repo');
  assert.equal(contract.discoveryCorpus.R1.sourcePdf, 'backend/docs/manuals/samsungny64dualfuel.pdf');
  assert.equal(contract.discoveryCorpus.R2.smokeModel, 'LSDL6336F');
  assert.equal(contract.discoveryCorpus.R2.status, 'DEFERRED_OPTIONAL');
  assert.equal(contract.discoveryCorpus.R3.status, 'DEFERRED_OPTIONAL');
  assert.equal(contract.discoveryCorpus.R3.manualStatus, 'in_repo');
  assert.equal(contract.discoveryCorpus.R3.plannedManualId, 'W11174814');

  assert.ok(contract.methodologyDimensions.r1VsFamilyNote.includes('Outcome A on R1'));
});

test('CG-13 divergence criteria and falsifiable outcomes A/B/C', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG13_DUAL_FUEL_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  const div = contract.divergenceCriteria;
  assert.ok(div.isNotDivergence.includes('Gas surface hardware not seen on pure-electric platforms'));
  assert.ok(div.isNotDivergence.includes('Shared control_board orchestrating both domains'));
  assert.ok(div.isDivergence.some((d: string) => d.includes('inseparable diagnostic function')));

  const outcomes = contract.fitTestOutcomes;
  assert.equal(outcomes.A.label, 'dual_fuel_fits_electric_contract');
  assert.equal(outcomes.B.label, 'partial_fit_requires_contract_revision');
  assert.equal(outcomes.C.label, 'dual_fuel_diverges');
  assert.equal(outcomes.A.predecided, false);
  assert.equal(outcomes.B.predecided, false);
  assert.equal(outcomes.C.predecided, false);
  assert.equal(outcomes.A.successMetrics.DIVERGES, 0);
  assert.equal(outcomes.A.successMetrics.canonicalExpansion, 0);

  const convection = contract.boundaryQuestions.find(
    (q: { id: string }) => q.id === 'convection_heating_element_dual_fuel',
  );
  assert.ok(convection.noEvidenceSemantics.includes('does not bind the conditional scope'));
});

test('frozen electric_range.json is immutable contract truth during CG-13', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG13_DUAL_FUEL_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );
  const cg12 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG12_INDUCTION_FIT_CLOSURE_v1.json'), 'utf8'),
  );

  const hash = sha256File(join(CANONICAL, 'electric_range.json'));
  assert.equal(hash, EXPECTED_FROZEN_ELECTRIC_HASH);
  assert.equal(contract.frozenContractUnderTest.hash, EXPECTED_FROZEN_ELECTRIC_HASH);
  assert.equal(cg12.frozenContractUnderTest.hashAtCg12Close, EXPECTED_FROZEN_ELECTRIC_HASH);

  assert.ok(contract.cumulativeExperimentNote.includes('electric (CG-10)'));
  assert.ok(contract.cumulativeExperimentNote.includes('dual-fuel (CG-13)'));
  assert.ok(contract.priorFitTestExclusion.cg12InductionNe58r9560.includes('different surface domain'));
  assert.ok(contract.deferredWork.familyBoundaryReview.includes('CG-11/12/13'));
});
