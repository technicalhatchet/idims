import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const FROZEN_HASH = '0edfd0988fa4f782d946bc7e65089ad018bbb769851be0c6f30a701851e72d54';

test('CG-RANGE-FAMILY-REVIEW closure stamps three independent approvals', () => {
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_REVIEW_CLOSURE_v1.json'), 'utf8'),
  );
  const review = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_REVIEW_v1.json'), 'utf8'),
  );

  assert.equal(closure.status, 'closed_successful');
  assert.equal(review.status, 'closed');
  assert.equal(review.closureArtifact, 'CG_RANGE_FAMILY_REVIEW_CLOSURE_v1.json');
  assert.equal(closure.approvedDecisions.canonicalNamingDecision.outcome, 'RENAME_TO_RANGE_OVEN');
  assert.equal(
    closure.approvedDecisions.templateRoutingDecision.outcome,
    'ROUTE_ALL_RANGE_IMPLEMENTATIONS_TO_SHARED_CONTRACT',
  );
  assert.equal(
    closure.approvedDecisions.historicalReferencePolicy.outcome,
    'APPROVE_RECOMMENDED_POLICY',
  );
  assert.equal(closure.approvedDecisions.canonicalNamingDecision.organizationalPrimaryId, 'range_oven');
  assert.equal(closure.approvedDecisions.canonicalNamingDecision.legacyAliasId, 'electric_range');
  assert.equal(review.successCriteria.allThreeDecisionsApproved, true);
});

test('CG-RANGE-FAMILY-REVIEW closure preserves historical fit record and blocks normalization', () => {
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_REVIEW_CLOSURE_v1.json'), 'utf8'),
  );
  const impl = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_ORGANIZATIONAL_IMPLEMENTATION_GATE_v1.json'), 'utf8'),
  );

  assert.equal(closure.cumulativeFitContext.frozenContractAtFitTime.hash, FROZEN_HASH);
  assert.equal(closure.cumulativeFitContext.canonicalHashMutations, 0);
  assert.ok(closure.approvedDecisions.canonicalNamingDecision.doNotMutate.includes('CG10_ELECTRIC_RANGE_FREEZE_LOCK_v1.json'));
  assert.equal(
    closure.approvedDecisions.historicalReferencePolicy.historicalTruth,
    'CG-11/12/13 tested electric_range rev1 — preserved as experimental record',
  );
  assert.equal(closure.blockedUntilImplementationGate.normalization, true);
  assert.equal(impl.status, 'active');
  assert.equal(impl.normalizationBlockedUntilGateGreen, true);
  assert.equal(closure.hierarchy.nextDisciplinedStep, 'CG_RANGE_ORGANIZATIONAL_IMPLEMENTATION_GATE_v1.json');
  assert.equal(impl.priorPhaseClosed, 'CG_RANGE_FAMILY_REVIEW_CLOSURE_v1.json');
});

test('CG-RANGE-FAMILY-REVIEW closure requires non-destructive implementation gate before normalization', () => {
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_REVIEW_CLOSURE_v1.json'), 'utf8'),
  );
  const impl = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_ORGANIZATIONAL_IMPLEMENTATION_GATE_v1.json'), 'utf8'),
  );

  assert.equal(closure.implementationSafeguard.policy, 'non_destructive_migration');
  assert.ok(closure.implementationSafeguard.doNot.includes('electric_range.json first'));
  assert.ok(impl.explicitNonGoals.some((g: string) => g.includes('normalization corpus')));
  assert.ok(impl.implementationTasks.some((t: { id: string }) => t.id === 'establish_legacy_alias'));
  assert.equal(impl.approvedTemplateRouting.resolveTo, 'range_oven');
  assert.equal(impl.approvedTemplateRouting.doesNotCreate.includes('gas_range.json'), true);
});
