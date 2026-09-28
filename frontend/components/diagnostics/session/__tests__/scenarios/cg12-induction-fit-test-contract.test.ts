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

test('CG-12 fit-test contract is closed with Outcome A and does not create induction_range.json', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG12_INDUCTION_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  assert.equal(contract.status, 'closed');
  assert.equal(contract.closureVerdict, 'CLOSED / INDUCTION_FITS_ELECTRIC_CONTRACT');
  assert.equal(contract.closureArtifact, 'CG12_INDUCTION_FIT_CLOSURE_v1.json');
  assert.equal(contract.r1SufficientForClosure, true);
  assert.equal(contract.r2RequiredForClosure, false);
  assert.equal(contract.phase, 'CG-12');
  assert.equal(contract.fitTestMode, 'fit_falsification_against_frozen_contract');
  assert.equal(contract.priorPhaseClosed, 'CG11_GAS_RANGE_FIT_CLOSURE_v1.json');
  assert.ok(contract.notCreating.includes('induction_range.json'));
  assert.ok(contract.notCreating.includes('mutations to electric_range.json'));
  assert.ok(contract.notCreating.includes('automatic promotion of induction_coil'));
  assert.ok(contract.notCreating.includes('normalization compounding targets'));
  assert.equal(contract.frozenContractUnderTest.immutable, true);
  assert.equal(contract.frozenContractUnderTest.canonicalHashMutationsAllowed, 0);
  assert.equal(contract.successCriteria.canonicalExpansion, 0);
  assert.equal(contract.successCriteria.closureStatus, 'closed_successful');
  assert.equal(contract.successCriteria.crossManufacturerMatrixStatus, 'PENDING');
  assert.equal(contract.successCriteria.fitAnalysisArtifact, 'CG12_INDUCTION_FIT_ANALYSIS_v1.json');
  assert.equal(contract.successCriteria.r2Mandatory, false);
  assert.equal(contract.successCriteria.r1ObservationStatus, 'complete');
  assert.equal(
    contract.successCriteria.r1ObservationArtifact,
    'SAMSUNG_NE58R9560WS_IR_CG12X_OBSERVATION_v1.json',
  );
});

test('CG-12 centerpiece and critical induction probe — not hardware word-matching', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG12_INDUCTION_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  const centerpiece = contract.centerpieceQuestion;
  assert.equal(centerpiece.id, 'induction_vs_frozen_electric_contract');
  assert.ok(centerpiece.question.includes('without canonical divergence'));
  assert.ok(centerpiece.disallowedShortcut.includes('resistance element'));

  const critical = contract.criticalInductionProbe;
  assert.equal(critical.frozenContractNode, 'surface_heating_system');
  assert.ok(critical.question.includes('new functional dependency'));
  assert.ok(critical.platformVocabularyGuard.includes('pan_detection'));
  assert.ok(critical.notEquivalentBecause.includes('must not be treated as equivalent'));

  const hypothesis = JSON.parse(
    readFileSync(join(CALIBRATION, 'electric_range_induction_fit_hypothesis_v1.json'), 'utf8'),
  );
  assert.equal(hypothesis.contract, 'CG12_INDUCTION_FIT_TEST_CONTRACT_v1.json');
  assert.equal(hypothesis.status, 'r1_observation_complete');
  assert.ok(hypothesis.criticalInductionHypothesis.notBecauseBothProduceHeat.includes('both produce cooktop heat'));
});

test('CG-12 cross-manufacturer matrix and R1-only opening rule', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG12_INDUCTION_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  const matrix = contract.crossManufacturerMatrix;
  assert.equal(matrix.columns.length, 3);
  assert.deepEqual(
    matrix.columns.map((c: { smokeModel: string }) => c.smokeModel),
    ['NE58R9560WS/AA', 'WFI505S0JZ', 'LSIL6334F'],
  );
  assert.equal(matrix.rows.length, 11);
  assert.ok(
    matrix.rows.some(
      (r: { probeId: string; criticalProbe?: boolean }) =>
        r.probeId === 'surface_heating_system_induction' && r.criticalProbe === true,
    ),
  );
  assert.equal(matrix.status, 'template_pending_observation');

  assert.ok(contract.discoveryCorpus.openingRequirement.includes('not a requirement to open CG-12'));
  assert.equal(contract.discoveryCorpus.R1.observationStatus, 'complete');
  assert.equal(contract.discoveryCorpus.R1.sourcePdf, 'backend/docs/manuals/samsunginductionne58h.pdf');
  assert.equal(
    contract.discoveryCorpus.R1.observationArtifact,
    'SAMSUNG_NE58R9560WS_IR_CG12X_OBSERVATION_v1.json',
  );
  assert.equal(contract.discoveryCorpus.R1.smokeModel, 'NE58R9560WS/AA');
  assert.equal(contract.discoveryCorpus.R2.smokeModel, 'WFI505S0JZ');
  assert.equal(contract.discoveryCorpus.R3.smokeModel, 'LSIL6334F');
  assert.equal(contract.discoveryCorpus.R2.status, 'planned');
  assert.equal(contract.discoveryCorpus.R3.status, 'planned');

  assert.equal(contract.methodologyDimensions.implementation_fit, contract.methodologyDimensions.implementation_fit);
  assert.ok(contract.methodologyDimensions.cross_manufacturer_consistency.includes('Samsung, Whirlpool, and LG'));
});

test('CG-12 divergence criteria and falsifiable outcomes A/B/C', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG12_INDUCTION_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  const div = contract.divergenceCriteria;
  assert.ok(div.isNotDivergence.includes('Pan detection'));
  assert.ok(div.isNotDivergence.includes('Inverter/power-module architecture'));
  assert.ok(div.isDivergence.some((d: string) => d.includes('conflates two functions')));

  const outcomes = contract.fitTestOutcomes;
  assert.equal(outcomes.A.label, 'induction_fits_electric_contract');
  assert.equal(outcomes.B.label, 'partial_fit_requires_contract_revision');
  assert.equal(outcomes.C.label, 'induction_diverges');
  assert.equal(outcomes.A.predecided, false);
  assert.equal(outcomes.B.predecided, false);
  assert.equal(outcomes.C.predecided, false);
  assert.equal(outcomes.A.successMetrics.DIVERGES, 0);
  assert.equal(outcomes.A.successMetrics.canonicalExpansion, 0);

  const convection = contract.boundaryQuestions.find(
    (q: { id: string }) => q.id === 'convection_heating_element_induction',
  );
  assert.ok(convection.noEvidenceSemantics.includes('does not bind the conditional scope'));
});

test('frozen electric_range.json is immutable contract truth during CG-12', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG12_INDUCTION_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );
  const cg11 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG11_GAS_RANGE_FIT_CLOSURE_v1.json'), 'utf8'),
  );

  const hash = sha256File(join(CANONICAL, 'electric_range.json'));
  assert.equal(hash, EXPECTED_FROZEN_ELECTRIC_HASH);
  assert.equal(contract.frozenContractUnderTest.hash, EXPECTED_FROZEN_ELECTRIC_HASH);
  assert.equal(cg11.frozenContractUnderTest.hashAtCg11Close, EXPECTED_FROZEN_ELECTRIC_HASH);

  assert.ok(
    contract.discoveryCorpus.R1.excludeFromR1.observationArtifacts.includes(
      'SAMSUNG_NE58_RANGE_er_cg10x_observation_v1.json',
    ),
  );
  assert.ok(
    contract.cg10Cg11CorpusExclusion.inductionR1MustNotReuse.some((s: string) =>
      s.includes('CG-10 electric discovery'),
    ),
  );
  assert.ok(contract.deferredWork.normalizationCompounding.includes('CG-13'));
});
