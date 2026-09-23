import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import { resolveCanonicalOntologyId } from '../../../knowledge/canonical/canonicalRegistry';

const RANGE_OVEN_HASH =
  'e29bb5fafe2afacdba3b45a1ec8e4ec0b73c78d51ff6319bb6a7c0e20a7b4fc5';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANONICAL = resolve(process.cwd(), 'components/diagnostics/knowledge/canonical');

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('CG-MICROWAVE-FIT closed Outcome B — authorizes discovery not microwave.json', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FIT_CLOSURE_v1.json'), 'utf8'),
  );
  const analysis = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FIT_ANALYSIS_v1.json'), 'utf8'),
  );
  const discovery = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_DISCOVERY_CONTRACT_v1.json'), 'utf8'),
  );

  assert.equal(contract.status, 'closed');
  assert.equal(contract.approvedFitOutcome, 'B');
  assert.equal(closure.verdict, 'CLOSED / MICROWAVE_GENUINE_FUNCTIONAL_DIVERGENCE');
  assert.equal(analysis.approvedFitOutcome.outcome, 'B');
  assert.equal(analysis.approvedFitOutcome.authorizesDiscoveryOnly, 'CG-MICROWAVE-DISCOVERY');
  assert.equal(discovery.status, 'closed');
  assert.equal(discovery.closureVerdict, 'CLOSED / MICROWAVE_FUNCTIONAL_CONTRACT_APPROVED');
  assert.equal(discovery.authorizedNextWorkstream, 'CG_MICROWAVE_FREEZE_CONTRACT_v1.json');
  assert.ok(discovery.notCreating.includes('microwave.json'));
});

test('fit artifacts immutable — discovery inherits triangulation as read-only input', () => {
  const analysis = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FIT_ANALYSIS_v1.json'), 'utf8'),
  );
  const discovery = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_DISCOVERY_CONTRACT_v1.json'), 'utf8'),
  );
  const triangulation = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FIT_TRIANGULATION_v1.json'), 'utf8'),
  );

  assert.equal(triangulation.humanBoundaryDecision.status, 'approved');
  assert.equal(triangulation.humanBoundaryDecision.approvedOutcome, 'B_genuine_divergence_documented');
  assert.ok(analysis.immutableFitInputs.artifacts.includes('CG_MICROWAVE_FIT_TRIANGULATION_v1.json'));
  assert.ok(discovery.immutableFitInputs.artifacts.includes('LG_LMHM2237_MICROWAVE_cg_microwave_fit_observation_v1.json'));
  assert.equal(discovery.discoveryCorpus.inheritedFromFit, true);
  assert.equal(discovery.discoveryCorpus.triangulation, 'CG_MICROWAVE_FIT_TRIANGULATION_v1.json');
});

test('discovery candidate proposes functions not component laundry list', () => {
  const candidate = JSON.parse(
    readFileSync(join(CALIBRATION, 'microwave_functional_contract_candidate_v1.json'), 'utf8'),
  );

  assert.equal(candidate.notCanonicalFile, true);
  assert.equal(candidate.status, 'approved_for_freeze_preparation');
  assert.equal(candidate.minimalFunctionBudget.coreCount, 7);
  assert.equal(candidate.minimalFunctionBudget.conditionalCount, 2);
  assert.ok(candidate.rejectedAsCanonicalNodes.includes('magnetron'));
  assert.ok(candidate.rejectedAsCanonicalNodes.includes('hv_capacitor'));
  assert.equal(
    candidate.proposedCanonicalFunctions.find((f: { id: string }) => f.id === 'hv_generation')
      ?.notPromotedAsSeparateCanonicalNodes?.includes('magnetron'),
    true,
  );
});

test('range_oven locked — no microwave canonical graph; zero canonical mutation', () => {
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FIT_CLOSURE_v1.json'), 'utf8'),
  );

  assert.equal(closure.governanceConclusion.canonicalExpansion, 0);
  assert.equal(closure.governanceConclusion.microwaveJsonAuthorized, false);
  assert.equal(closure.governanceConclusion.rangeOvenVariantRejected, true);
  assert.equal(closure.governanceConclusion.microwaveJsonAuthorized, false);
  assert.equal(sha256File(join(CANONICAL, 'range_oven.json')), RANGE_OVEN_HASH);
});
