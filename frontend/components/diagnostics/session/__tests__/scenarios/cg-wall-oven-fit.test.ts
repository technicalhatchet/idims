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
  range_oven: 'e29bb5fafe2afacdba3b45a1ec8e4ec0b73c78d51ff6319bb6a7c0e20a7b4fc5',
  electric_range: '0edfd0988fa4f782d946bc7e65089ad018bbb769851be0c6f30a701851e72d54',
  french_door_refrigerator: 'adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9',
  vented_dryer: 'db48a9a1271843fc63d871330c633f468c537fc14242c8d537e611375992b714',
  heat_pump_dryer: 'd7a98c826d011a9fdef4b8c91ebd4d66ff88629f7d7b91357d43fee42c32d3bb',
  aio_laundry_combo: 'be3799a991b3d778b62e60a7ec3d91dfd6fe82432e3f9ac8663d607008081183',
  microwave: '3c9ef98e07c0b87d5f3ea9e313deb21892d75fd563bff397a0cc33aba55e533d',
} as const;

const APPROVED_CLASSIFICATIONS = [
  'range_oven',
  'shared_function',
  'implementation_specific',
  'unresolved',
] as const;

const PERMITTED_OUTCOMES = [
  'proven_variant',
  'composition',
  'architectural_divergence',
  'insufficient_evidence',
] as const;

function sha256File(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(CALIBRATION, name), 'utf8'));
}

test('wall oven fit contract active — blocks wall_oven.json; host hypothesis not assumed', () => {
  const contract = readJson('CG_WALL_OVEN_FIT_TEST_CONTRACT_v1.json');

  assert.equal(contract.workstream, 'CG-WALL-OVEN-FIT-TEST');
  assert.equal(contract.status, 'active');
  assert.ok((contract.notCreating as string[]).includes('wall_oven.json'));
  assert.ok((contract.notCreating as string[]).includes('mutations to range_oven.json'));
  assert.equal(
    (contract.hostHypothesis as { treatedAs: string }).treatedAs,
    'hypothesis_only',
  );
  assert.equal((contract.corpusSurvey as { wallOvenWitnessCount: number }).wallOvenWitnessCount, 2);
});

test('wall oven fit: no canonical json; frozen graph hashes unchanged', () => {
  assert.equal(existsSync(join(CANONICAL, 'wall_oven.json')), false);

  for (const [family, expectedHash] of Object.entries(FROZEN_HASHES)) {
    const actualHash = sha256File(join(CANONICAL, `${family}.json`));
    assert.equal(actualHash, expectedHash, `${family} hash must be unchanged`);
  }
});

test('W11174422 and Samsung NV51 observations: all paths classified; freestanding not substituted', () => {
  const w1 = readJson('CG_W11174422_FIT_OBSERVATION_v1.json');
  const w2 = readJson('CG_SAMSUNG_NV51_FIT_OBSERVATION_v1.json');

  const w1Paths = w1.diagnosticPathClassifications as Array<{
    pathId: string;
    classification: string;
    provenance: string;
  }>;
  const w2Paths = w2.diagnosticPathClassifications as Array<{
    pathId: string;
    classification: string;
    provenance: string;
  }>;

  assert.equal(w1Paths.length, 9);
  assert.equal(w2Paths.length, 8);

  for (const path of [...w1Paths, ...w2Paths]) {
    assert.ok(
      (APPROVED_CLASSIFICATIONS as readonly string[]).includes(path.classification),
      `${path.pathId} uses approved vocabulary`,
    );
    assert.ok(path.provenance.length > 0, `${path.pathId} has provenance`);
  }

  assert.equal((w1.classificationHistogram as { unresolved: number }).unresolved, 0);
  assert.equal((w2.classificationHistogram as { unresolved: number }).unresolved, 0);
});

test('wall oven fit analysis: exactly one hard outcome — composition', () => {
  const analysis = readJson('CG_WALL_OVEN_FIT_ANALYSIS_v1.json');

  assert.ok((PERMITTED_OUTCOMES as readonly string[]).includes(analysis.hardOutcome as string));
  assert.equal(analysis.hardOutcome, 'composition');
  assert.equal(
    (analysis.hardOutcomeGate as { exactlyOne: boolean }).exactlyOne,
    true,
  );
  assert.equal((analysis.corpusFinding as { wallOvenWitnessCount: number }).wallOvenWitnessCount, 2);
  assert.equal((analysis.genuineDivergencesFound as unknown[]).length, 0);
});

test('surface_heating_system omitted — not architectural divergence', () => {
  const analysis = readJson('CG_WALL_OVEN_FIT_ANALYSIS_v1.json');
  const omitted = (analysis.fitAgainstRangeOven as { rangeSpecificDomainsNotInstantiated: string[] })
    .rangeSpecificDomainsNotInstantiated;

  assert.ok(omitted.includes('surface_heating_system'));

  const w1 = readJson('CG_W11174422_FIT_OBSERVATION_v1.json');
  assert.ok(
    (w1.rangeSpecificDomainsAbsent as { surface_heating_system: string }).surface_heating_system.includes(
      'product design',
    ),
  );
});

test('freestanding range manuals excluded as wall-oven substitutes', () => {
  const triangulation = readJson('CG_WALL_OVEN_FIT_TRIANGULATION_v1.json');
  const excluded = triangulation.excludedSubstitutes as Array<{
    countsAsWallOvenWitness: boolean;
  }>;

  assert.ok(excluded.length >= 2);
  for (const entry of excluded) {
    assert.equal(entry.countsAsWallOvenWitness, false);
  }

  const analysis = readJson('CG_WALL_OVEN_FIT_ANALYSIS_v1.json');
  assert.equal(
    (analysis.corpusFinding as { freestandingRangeSubstitutionRejected: boolean })
      .freestandingRangeSubstitutionRejected,
    true,
  );
});

test('wall oven fit closure — composition of range_oven; no discovery', () => {
  const closure = readJson('CG_WALL_OVEN_FIT_CLOSURE_v1.json');
  assert.equal(closure.verdict, 'CLOSED / WALL_OVEN_COMPOSITION_OF_RANGE_OVEN');
  assert.equal((closure.approvedFitOutcome as { outcome: string }).outcome, 'composition');
  assert.equal((closure.governanceConclusion as { discoveryAuthorized: boolean }).discoveryAuthorized, false);
  assert.equal((closure.governanceConclusion as { hostFamilyProven: boolean }).hostFamilyProven, true);
  assert.equal((closure.evidenceWitnesses as { used: unknown[] }).used.length, 2);
  assert.equal((closure.genuineDivergences as unknown[]).length, 0);

  assert.equal(
    existsSync(join(CALIBRATION, 'CG_WALL_OVEN_FIT_DIVERGENCE_PACKAGE_v1.json')),
    false,
  );
});

test('triangulation: cross-manufacturer witnesses; double-oven composition; recommends composition', () => {
  const triangulation = readJson('CG_WALL_OVEN_FIT_TRIANGULATION_v1.json');

  assert.equal(triangulation.witnessCount, 2);
  assert.equal(triangulation.crossManufacturerTriangulation, true);
  assert.equal(
    (triangulation.triangulationVerdict as { recommendAnalysisOutcome: string }).recommendAnalysisOutcome,
    'composition',
  );
  assert.equal(
    (triangulation.functionalDomainTriangulation as { double_oven_composition: { mapsToHost: boolean } })
      .double_oven_composition.mapsToHost,
    true,
  );
});

test('fit contract guards: freestanding substitution and double-oven composition', () => {
  const contract = readJson('CG_WALL_OVEN_FIT_TEST_CONTRACT_v1.json');
  assert.ok(
    (contract.hardGateRule as { freestandingRangeSubstitutionGuard: string })
      .freestandingRangeSubstitutionGuard.includes('W11174426'),
  );
  assert.ok(
    (contract.hardGateRule as { doubleOvenGuard: string }).doubleOvenGuard.includes('composition'),
  );
});
