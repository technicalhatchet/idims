import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const FROZEN_HASH = '0edfd0988fa4f782d946bc7e65089ad018bbb769851be0c6f30a701851e72d54';

test('CG-RANGE-FAMILY-REVIEW is closed with three independent approvals stamped', () => {
  const review = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_REVIEW_v1.json'), 'utf8'),
  );
  const sequence = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_WORKSTREAM_SEQUENCE_v1.json'), 'utf8'),
  );

  assert.equal(review.status, 'closed');
  assert.equal(review.closureVerdict, 'CLOSED / THREE_ORGANIZATIONAL_DECISIONS_APPROVED');
  assert.equal(review.reviewMode, 'organizational_gate_not_diagnostic');
  assert.equal(review.fitExperimentComplete, true);
  assert.equal(review.canonicalNamingDecision.status, 'approved');
  assert.equal(review.canonicalNamingDecision.approvedOutcome, 'RENAME_TO_RANGE_OVEN');
  assert.equal(review.templateRoutingDecision.approvedOutcome, 'ROUTE_ALL_RANGE_IMPLEMENTATIONS_TO_SHARED_CONTRACT');
  assert.equal(review.historicalReferencePolicy.approvedOutcome, 'APPROVE_RECOMMENDED_POLICY');
  assert.equal(review.successCriteria.implementationGateArtifact, 'CG_RANGE_ORGANIZATIONAL_IMPLEMENTATION_GATE_v1.json');

  const familyReviewPhase = sequence.disciplinedSequence.find(
    (p: { phase: string }) => p.phase === 'CG-RANGE-FAMILY-REVIEW',
  );
  assert.equal(familyReviewPhase.status, 'closed');
  assert.equal(familyReviewPhase.closureArtifact, 'CG_RANGE_FAMILY_REVIEW_CLOSURE_v1.json');
});

test('CG-RANGE-FAMILY-REVIEW naming and routing outcomes are separable', () => {
  const review = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_REVIEW_v1.json'), 'utf8'),
  );

  const naming = review.canonicalNamingDecision.possibleOutcomes;
  assert.ok(naming.KEEP_ELECTRIC_RANGE);
  assert.ok(naming.RENAME_TO_RANGE_OVEN);
  assert.ok(naming.DEFER_RENAME);
  assert.equal(naming.RENAME_TO_RANGE_OVEN.requiresAliasRecord, true);

  const routing = review.templateRoutingDecision.possibleOutcomes;
  assert.ok(routing.ROUTE_ALL_RANGE_IMPLEMENTATIONS_TO_SHARED_CONTRACT);
  assert.ok(routing.KEEP_IMPLEMENTATION_TEMPLATES_SEPARATE);
  assert.ok(routing.DEFER_ROUTING);
  assert.equal(routing.ROUTE_ALL_RANGE_IMPLEMENTATIONS_TO_SHARED_CONTRACT.doesNotCreate.includes('gas_range.json'), true);
  assert.equal(review.templateRoutingDecision.independentFromNamingDecision, true);
});

test('CG-RANGE-FAMILY-REVIEW preserves CG-10–13 historical record and blocks normalization', () => {
  const review = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_REVIEW_v1.json'), 'utf8'),
  );
  const cg13 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG13_DUAL_FUEL_FIT_CLOSURE_v1.json'), 'utf8'),
  );

  assert.equal(review.cumulativeFitEvidence.frozenContract.hash, FROZEN_HASH);
  assert.equal(review.cumulativeFitEvidence.frozenContract.canonicalHashMutationsAcrossFitTests, 0);
  assert.equal(review.cumulativeFitEvidence.implementationsTested.length, 4);

  const frozen = review.historicalReferencePolicy.referenceCategories.fitTestAndClosureArtifacts;
  assert.equal(frozen.policyDefault, 'historically_frozen');
  assert.equal(frozen.frozenHistoricalRecord['CG-11'], 'fit against electric_range rev1');
  assert.equal(frozen.frozenHistoricalRecord['CG-13'], 'fit against electric_range rev1');

  assert.ok(review.corroboratingEvidenceNotHistoricalR1.policy.includes('does not retroactively reopen'));
  assert.equal(review.corroboratingEvidenceNotHistoricalR1.manualId, 'W11174814');
  assert.ok(review.blockedUntilReviewCompletes.normalization.some((n: string) => n.includes('W11174814')));
  assert.equal(cg13.verdict, 'CLOSED / DUAL_FUEL_FITS_ELECTRIC_CONTRACT');
});

test('CG-RANGE-FAMILY-REVIEW documents current template routing gaps', () => {
  const review = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_REVIEW_v1.json'), 'utf8'),
  );

  const templates = review.templateRoutingDecision.proposedRoutingModel.implementationTemplates;
  const gas = templates.find((t: { templateId: string }) => t.templateId === 'gas_range');
  const induction = templates.find((t: { templateId: string }) => t.templateId === 'induction_range');
  const dual = templates.find((t: { templateId: string }) => t.templateId === 'dual_fuel_range');

  assert.ok(gas.canonicalRouteToday.includes('null'));
  assert.equal(induction.status, 'not_registered');
  assert.equal(dual.status, 'not_registered');

  const gaps = review.historicalReferencePolicy.referenceCategories.routingAndTemplateRegistries.currentRoutingGaps;
  assert.ok(gaps.some((g: string) => g.includes('gas_range')));
  assert.ok(gaps.some((g: string) => g.includes('dual_fuel_range')));
});
