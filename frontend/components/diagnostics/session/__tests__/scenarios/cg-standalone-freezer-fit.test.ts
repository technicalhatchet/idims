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
  french_door_refrigerator: 'adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9',
  front_load_washer: '9fed1c36b985f32da8107382cb0cab8e65c509f8cdea7ac72631718b82f99c05',
  vented_dryer: 'db48a9a1271843fc63d871330c633f468c537fc14242c8d537e611375992b714',
  heat_pump_dryer: 'd7a98c826d011a9fdef4b8c91ebd4d66ff88629f7d7b91357d43fee42c32d3bb',
  aio_laundry_combo: 'be3799a991b3d778b62e60a7ec3d91dfd6fe82432e3f9ac8663d607008081183',
  microwave: '3c9ef98e07c0b87d5f3ea9e313deb21892d75fd563bff397a0cc33aba55e533d',
} as const;

const APPROVED_CLASSIFICATIONS = [
  'french_door_refrigerator',
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

const REJECTED_WITNESS_MODELS = [
  'WZF79R20DW',
  'WZF56R16DW',
  'RZ11M7074SA',
  'RZ11T7474AP',
];

function sha256File(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(CALIBRATION, name), 'utf8'));
}

test('standalone freezer fit contract active — blocks standalone_freezer.json', () => {
  const contract = readJson('CG_STANDALONE_FREEZER_FIT_TEST_CONTRACT_v1.json');

  assert.equal(contract.workstream, 'CG-STANDALONE-FREEZER-FIT-TEST');
  assert.equal(contract.status, 'active');
  assert.ok((contract.notCreating as string[]).includes('standalone_freezer.json'));
  assert.ok(
    (contract.notCreating as string[]).includes('mutations to french_door_refrigerator.json'),
  );
  assert.equal(
    (contract.hostHypothesis as { primary: string }).primary,
    'french_door_refrigerator',
  );
  assert.equal((contract.successCriteria as { canonicalExpansion: number }).canonicalExpansion, 0);
});

test('standalone freezer fit: no canonical json; frozen graph hashes unchanged', () => {
  assert.equal(existsSync(join(CANONICAL, 'standalone_freezer.json')), false);

  for (const [family, expectedHash] of Object.entries(FROZEN_HASHES)) {
    const actualHash = sha256File(join(CANONICAL, `${family}.json`));
    assert.equal(actualHash, expectedHash, `${family} hash must be unchanged`);
  }
});

test('Midea UZ21 observation: all procedures classified; candidate Whirlpool/Samsung not substituted', () => {
  const observation = readJson('CG_MIDEA_UZ21_FIT_OBSERVATION_v1.json');
  const procedures = observation.procedureClassifications as Array<{
    procedureId: string;
    classification: string;
    provenance: string;
  }>;

  assert.equal(procedures.length, 7);
  for (const proc of procedures) {
    assert.ok(
      (APPROVED_CLASSIFICATIONS as readonly string[]).includes(proc.classification),
      `${proc.procedureId} uses approved vocabulary`,
    );
    assert.ok(proc.provenance && proc.provenance.length > 0);
  }

  const histogram = observation.classificationHistogram as Record<string, number>;
  assert.equal(
    Object.values(histogram).reduce((a, b) => a + b, 0),
    7,
  );
  assert.equal(histogram.french_door_refrigerator, 7);
  assert.equal(histogram.unresolved, 0);

  const rejected = observation.candidateWitnessesNotInCorpus as string[];
  for (const model of REJECTED_WITNESS_MODELS) {
    assert.ok(rejected.some((r) => r.includes(model)));
  }
});

test('standalone freezer fit analysis: exactly one hard outcome — composition', () => {
  const analysis = readJson('CG_STANDALONE_FREEZER_FIT_ANALYSIS_v1.json');

  assert.ok((PERMITTED_OUTCOMES as readonly string[]).includes(analysis.hardOutcome as string));
  assert.equal(analysis.hardOutcome, 'composition');
  assert.equal(
    (analysis.hardOutcomeGate as { exactlyOne: boolean }).exactlyOne,
    true,
  );
  assert.equal(
    (analysis.fitAgainstFrenchDoorRefrigerator as { hostFamily: string }).hostFamily,
    'french_door_refrigerator',
  );
  assert.equal((analysis.genuineDivergencesFound as unknown[]).length, 0);
  assert.equal((analysis.headlineMetrics as { canonicalExpansion: number }).canonicalExpansion, 0);
});

test('refrigerator-specific domains omitted — not architectural divergence', () => {
  const analysis = readJson('CG_STANDALONE_FREEZER_FIT_ANALYSIS_v1.json');
  const omitted = (
    analysis.fitAgainstFrenchDoorRefrigerator as {
      refrigeratorSpecificDomainsNotInstantiated: string[];
    }
  ).refrigeratorSpecificDomainsNotInstantiated;

  assert.ok(omitted.includes('air_damper'));
  assert.ok(omitted.includes('ice_maker'));
  assert.ok(omitted.includes('water_dispenser'));
});

test('standalone freezer fit closure — composition of french_door_refrigerator; no discovery', () => {
  const closure = readJson('CG_STANDALONE_FREEZER_FIT_CLOSURE_v1.json');
  assert.equal(closure.verdict, 'CLOSED / STANDALONE_FREEZER_COMPOSITION_OF_FRENCH_DOOR_REFRIGERATOR');
  assert.equal((closure.approvedFitOutcome as { outcome: string }).outcome, 'composition');
  assert.equal(
    (closure.governanceConclusion as { hostFamily: string }).hostFamily,
    'french_door_refrigerator',
  );
  assert.equal((closure.governanceConclusion as { discoveryAuthorized: boolean }).discoveryAuthorized, false);
  assert.equal((closure.governanceConclusion as { newCanonicalGraphRequired: boolean }).newCanonicalGraphRequired, false);
  assert.equal((closure.genuineDivergences as unknown[]).length, 0);
  assert.equal(closure.authorizedNextWorkstream, null);

  assert.equal(
    existsSync(join(CALIBRATION, 'CG_STANDALONE_FREEZER_FIT_DIVERGENCE_PACKAGE_v1.json')),
    false,
  );
});

test('triangulation: single witness; Whirlpool/Samsung absent; recommends composition', () => {
  const triangulation = readJson('CG_STANDALONE_FREEZER_FIT_TRIANGULATION_v1.json');

  assert.equal(triangulation.witnessCount, 1);
  assert.equal(triangulation.crossManufacturerTriangulation, false);
  assert.equal(
    (triangulation.triangulationVerdict as { recommendAnalysisOutcome: string })
      .recommendAnalysisOutcome,
    'composition',
  );

  const rejected = triangulation.candidateWitnessesRejected as { models: string[] };
  assert.ok(rejected.models.some((m) => m.includes('WZF79')));
  assert.ok(rejected.models.some((m) => m.includes('RZ11')));
});

test('fit contract: host hypothesis not assumed; physical component guard present', () => {
  const contract = readJson('CG_STANDALONE_FREEZER_FIT_TEST_CONTRACT_v1.json');
  assert.equal(
    (contract.hostHypothesis as { treatedAs: string }).treatedAs,
    'hypothesis_only',
  );
  assert.ok(
    (contract.hardGateRule as { physicalComponentGuard: string }).physicalComponentGuard.includes(
      'implementation',
    ),
  );

  const w1 = (contract.candidateWitnesses as { ingested: Array<{ witnessId: string }> }).ingested[0];
  assert.equal(w1.witnessId, 'W1');
});
