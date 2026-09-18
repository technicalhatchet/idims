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

test('cooktop fit contract active — blocks cooktop.json; host hypothesis not assumed', () => {
  const contract = readJson('CG_COOKTOP_FIT_TEST_CONTRACT_v1.json');

  assert.equal(contract.workstream, 'CG-COOKTOP-FIT-TEST');
  assert.equal(contract.status, 'active');
  assert.ok((contract.notCreating as string[]).includes('cooktop.json'));
  assert.ok((contract.notCreating as string[]).includes('mutations to range_oven.json'));
  assert.equal(
    (contract.hostHypothesis as { treatedAs: string }).treatedAs,
    'hypothesis_only',
  );
  assert.equal(
    (contract.corpusSurvey as { standaloneCooktopWitnessCount: number }).standaloneCooktopWitnessCount,
    1,
  );
});

test('cooktop fit: no canonical json; frozen graph hashes unchanged', () => {
  assert.equal(existsSync(join(CANONICAL, 'cooktop.json')), false);

  for (const [family, expectedHash] of Object.entries(FROZEN_HASHES)) {
    const actualHash = sha256File(join(CANONICAL, `${family}.json`));
    assert.equal(actualHash, expectedHash, `${family} hash must be unchanged`);
  }
});

test('W11461580 observation: all paths classified; slide-in range not substituted', () => {
  const observation = readJson('CG_W11461580_FIT_OBSERVATION_v1.json');
  const paths = observation.diagnosticPathClassifications as Array<{
    pathId: string;
    classification: string;
    provenance: string;
  }>;

  assert.equal(paths.length, 11);
  for (const path of paths) {
    assert.ok(
      (APPROVED_CLASSIFICATIONS as readonly string[]).includes(path.classification),
      `${path.pathId} uses approved vocabulary`,
    );
    assert.ok(path.provenance.length > 0, `${path.pathId} has provenance`);
  }

  const rejected = observation.rejectedMappings as Array<{ candidate: string }>;
  assert.ok(
    rejected.some((entry) => entry.candidate.includes('samsunginductionne58h')),
    'slide-in range substitute rejected',
  );
});

test('cooktop fit analysis: exactly one hard outcome — composition', () => {
  const analysis = readJson('CG_COOKTOP_FIT_ANALYSIS_v1.json');

  assert.ok((PERMITTED_OUTCOMES as readonly string[]).includes(analysis.hardOutcome as string));
  assert.equal(analysis.hardOutcome, 'composition');
  assert.equal(
    (analysis.hardOutcomeGate as { exactlyOne: boolean }).exactlyOne,
    true,
  );
  assert.equal(
    (analysis.corpusFinding as { standaloneCooktopWitnessCount: number }).standaloneCooktopWitnessCount,
    1,
  );
  assert.equal((analysis.genuineDivergencesFound as unknown[]).length, 0);
});

test('oven domains omitted — not architectural divergence', () => {
  const analysis = readJson('CG_COOKTOP_FIT_ANALYSIS_v1.json');
  const omitted = (
    analysis.fitAgainstRangeOven as { rangeSpecificDomainsNotInstantiated: string[] }
  ).rangeSpecificDomainsNotInstantiated;

  assert.ok(omitted.includes('oven_heat_generation'));

  const observation = readJson('CG_W11461580_FIT_OBSERVATION_v1.json');
  assert.ok(
    (observation.ovenSpecificDomainsAbsent as { oven_heat_generation: string }).oven_heat_generation.includes(
      'cooktop-only',
    ),
  );
});

test('IPC/IGBT not promoted — implementation overlay only', () => {
  const observation = readJson('CG_W11461580_FIT_OBSERVATION_v1.json');
  const rejected = observation.rejectedMappings as Array<{ candidate: string }>;
  assert.ok(rejected.some((entry) => entry.candidate.toLowerCase().includes('igbt')));

  const igbtPath = (observation.diagnosticPathClassifications as Array<{ pathId: string; classification: string }>).find(
    (path) => path.pathId === 'w11461580-igbt-ntc-hardware',
  );
  assert.equal(igbtPath?.classification, 'implementation_specific');
});

test('freestanding range manuals excluded as cooktop substitutes', () => {
  const triangulation = readJson('CG_COOKTOP_FIT_TRIANGULATION_v1.json');
  const excluded = triangulation.excludedSubstitutes as Array<{
    countsAsCooktopWitness: boolean;
  }>;

  assert.ok(excluded.length >= 2);
  for (const entry of excluded) {
    assert.equal(entry.countsAsCooktopWitness, false);
  }
});

test('cooktop fit closure — composition of range_oven; no discovery', () => {
  const closure = readJson('CG_COOKTOP_FIT_CLOSURE_v1.json');
  assert.equal(closure.verdict, 'CLOSED / COOKTOP_COMPOSITION_OF_RANGE_OVEN');
  assert.equal((closure.approvedFitOutcome as { outcome: string }).outcome, 'composition');
  assert.equal((closure.governanceConclusion as { discoveryAuthorized: boolean }).discoveryAuthorized, false);
  assert.equal((closure.governanceConclusion as { hostFamilyProven: boolean }).hostFamilyProven, true);
  assert.equal((closure.evidenceWitnesses as { used: unknown[] }).used.length, 1);
  assert.equal((closure.genuineDivergences as unknown[]).length, 0);
  assert.equal(closure.authorizedNextWorkstream, 'CG-CANONICAL-ARCHITECTURE-COMPLETE');

  assert.equal(
    existsSync(join(CALIBRATION, 'CG_COOKTOP_FIT_DIVERGENCE_PACKAGE_v1.json')),
    false,
  );
});

test('triangulation: induction witness; gas/radiant gap documented; recommends composition', () => {
  const triangulation = readJson('CG_COOKTOP_FIT_TRIANGULATION_v1.json');

  assert.equal(triangulation.witnessCount, 1);
  assert.equal(
    (triangulation.thermalImplementationCoverage as { gas: unknown[] }).gas.length,
    0,
  );
  assert.equal(
    (triangulation.triangulationVerdict as { recommendAnalysisOutcome: string }).recommendAnalysisOutcome,
    'composition',
  );
});

test('fit contract guards: freestanding substitution and physical component guard', () => {
  const contract = readJson('CG_COOKTOP_FIT_TEST_CONTRACT_v1.json');
  assert.ok(
    (contract.hardGateRule as { freestandingRangeSubstitutionGuard: string })
      .freestandingRangeSubstitutionGuard.includes('freestanding'),
  );
  assert.ok(
    (contract.hardGateRule as { physicalComponentGuard: string }).physicalComponentGuard.includes('IGBT'),
  );
});
