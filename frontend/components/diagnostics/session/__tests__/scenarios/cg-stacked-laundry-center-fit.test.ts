import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const CANONICAL = resolve(process.cwd(), 'components/diagnostics/knowledge/canonical');

const FROZEN_HASHES = {
  front_load_washer: '9fed1c36b985f32da8107382cb0cab8e65c509f8cdea7ac72631718b82f99c05',
  top_load_washer: 'dee6b0c7128706eb78ac0e290090cd3d79d98dad579f41d6fa0a36ea3fdbf2b5',
  vented_dryer: 'db48a9a1271843fc63d871330c633f468c537fc14242c8d537e611375992b714',
  heat_pump_dryer: 'd7a98c826d011a9fdef4b8c91ebd4d66ff88629f7d7b91357d43fee42c32d3bb',
  aio_laundry_combo: 'be3799a991b3d778b62e60a7ec3d91dfd6fe82432e3f9ac8663d607008081183',
  microwave: '3c9ef98e07c0b87d5f3ea9e313deb21892d75fd563bff397a0cc33aba55e533d',
} as const;

const APPROVED_CLASSIFICATIONS = [
  'vented_dryer',
  'front_load_washer',
  'top_load_washer',
  'shared_function',
  'implementation_specific',
  'unresolved',
] as const;

const PERMITTED_OUTCOMES = [
  'proven_variant',
  'architectural_divergence',
  'insufficient_evidence',
] as const;

function sha256File(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(CALIBRATION, name), 'utf8'));
}

test('stacked laundry fit contract active — blocks stacked_laundry_center.json', () => {
  const contract = readJson('CG_STACKED_LAUNDRY_CENTER_FIT_TEST_CONTRACT_v1.json');

  assert.equal(contract.workstream, 'CG-STACKED-LAUNDRY-CENTER-FIT-TEST');
  assert.equal(contract.status, 'active');
  assert.ok((contract.notCreating as string[]).includes('stacked_laundry_center.json'));
  assert.ok((contract.notCreating as string[]).includes('mutations to vented_dryer.json'));
  assert.ok((contract.notCreating as string[]).includes('mutations to aio_laundry_combo.json'));
  assert.equal((contract.successCriteria as { canonicalExpansion: number }).canonicalExpansion, 0);
});

test('stacked laundry fit: no canonical json; frozen graph hashes unchanged', () => {
  assert.equal(existsSync(join(CANONICAL, 'stacked_laundry_center.json')), false);
  assert.equal(existsSync(join(CANONICAL, 'stacked_laundry.json')), false);

  for (const [family, expectedHash] of Object.entries(FROZEN_HASHES)) {
    const actualHash = sha256File(join(CANONICAL, `${family}.json`));
    assert.equal(actualHash, expectedHash, `${family} hash must be unchanged`);
  }
});

test('GUD27 observation: all dryer procedures classified with provenance', () => {
  const observation = readJson('CG_GUD27_FIT_OBSERVATION_v1.json');
  const procedures = observation.procedureClassifications as Array<{
    procedureId: string;
    classification: string;
    provenance: string;
  }>;

  assert.equal(procedures.length, 6);
  for (const proc of procedures) {
    assert.ok(
      (APPROVED_CLASSIFICATIONS as readonly string[]).includes(proc.classification),
      `${proc.procedureId} uses approved vocabulary`,
    );
    assert.ok(proc.provenance && proc.provenance.length > 0, `${proc.procedureId} has provenance`);
  }

  const histogram = observation.classificationHistogram as Record<string, number>;
  const histogramSum = Object.values(histogram).reduce((a, b) => a + b, 0);
  assert.equal(histogramSum, 6);
  assert.equal(histogram.vented_dryer, 5);
  assert.equal(histogram.implementation_specific, 1);
  assert.equal(histogram.unresolved, 0);
});

test('stacked laundry fit analysis: exactly one hard outcome — proven_variant', () => {
  const analysis = readJson('CG_STACKED_LAUNDRY_CENTER_FIT_ANALYSIS_v1.json');

  assert.ok((PERMITTED_OUTCOMES as readonly string[]).includes(analysis.hardOutcome as string));
  assert.equal(analysis.hardOutcome, 'proven_variant');
  assert.equal(
    (analysis.hardOutcomeGate as { exactlyOne: boolean }).exactlyOne,
    true,
  );
  assert.equal((analysis.headlineMetrics as { canonicalExpansion: number }).canonicalExpansion, 0);
  assert.equal(
    (analysis.headlineMetrics as { stackedLaundryCenterJsonCreated: boolean })
      .stackedLaundryCenterJsonCreated,
    false,
  );
  assert.equal(
    (analysis.composedDecompositionHypothesis as { result: string }).result,
    'accepted',
  );
});

test('stacked laundry not AIO — separate sections, no integrated orchestration', () => {
  const analysis = readJson('CG_STACKED_LAUNDRY_CENTER_FIT_ANALYSIS_v1.json');
  const aioFit = analysis.fitAgainstAioLaundryCombo as {
    verdict: string;
    rationale: string;
  };
  assert.equal(aioFit.verdict, 'not_applicable_host_rejected');
  assert.ok(aioFit.rationale.includes('integrated_laundry_orchestration'));

  const integration = analysis.integrationAnalysis as {
    integratedWashDryOrchestration: boolean;
    manualLoadTransfer: boolean;
  };
  assert.equal(integration.integratedWashDryOrchestration, false);
  assert.equal(integration.manualLoadTransfer, true);
});

test('stacked laundry fit closure — decomposes to vented_dryer; no discovery', () => {
  const closure = readJson('CG_STACKED_LAUNDRY_CENTER_FIT_CLOSURE_v1.json');
  assert.equal(closure.verdict, 'CLOSED / STACKED_LAUNDRY_DECOMPOSES_TO_EXISTING_CONTRACTS');
  assert.equal(
    (closure.approvedFitOutcome as { outcome: string }).outcome,
    'proven_variant',
  );
  assert.equal((closure.governanceConclusion as { discoveryAuthorized: boolean }).discoveryAuthorized, false);
  assert.equal((closure.governanceConclusion as { newCanonicalGraphRequired: boolean }).newCanonicalGraphRequired, false);
  assert.equal(
    (closure.architecturalDisposition as { drySectionHost: string }).drySectionHost,
    'vented_dryer',
  );
  assert.equal(closure.authorizedNextWorkstream, null);

  assert.equal(
    existsSync(join(CALIBRATION, 'CG_STACKED_LAUNDRY_CENTER_FIT_DIVERGENCE_PACKAGE_v1.json')),
    false,
  );
});

test('triangulation: single witness; recommends proven_variant', () => {
  const triangulation = readJson('CG_STACKED_LAUNDRY_CENTER_FIT_TRIANGULATION_v1.json');

  assert.equal(triangulation.witnessCount, 1);
  assert.equal(triangulation.crossManufacturerTriangulation, false);
  assert.equal(
    (triangulation.triangulationVerdict as { recommendAnalysisOutcome: string })
      .recommendAnalysisOutcome,
    'proven_variant',
  );
  assert.equal(
    (triangulation.integrationTriangulation as { vsAioLaundryCombo: { integratedOrchestration: boolean } })
      .vsAioLaundryCombo.integratedOrchestration,
    false,
  );
});

test('fit contract distinguishes stacked center from AIO and mechanical timer guard', () => {
  const contract = readJson('CG_STACKED_LAUNDRY_CENTER_FIT_TEST_CONTRACT_v1.json');
  assert.ok(
    (contract.hardGateRule as { aioDistinctionGuard: string }).aioDistinctionGuard.includes(
      'aio_laundry_combo',
    ),
  );
  assert.ok(
    (contract.hardGateRule as { mechanicalTimerGuard: string }).mechanicalTimerGuard.includes(
      'vented_dryer',
    ),
  );

  const w1 = (contract.discoveryCorpus as { W1: { procedureCount: number } }).W1;
  assert.equal(w1.procedureCount, 6);
});
