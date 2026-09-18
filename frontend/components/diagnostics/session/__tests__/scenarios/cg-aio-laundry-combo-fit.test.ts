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
} as const;

const APPROVED_CLASSIFICATIONS = [
  'front_load_washer',
  'top_load_washer',
  'vented_dryer',
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

test('AIO fit-test contract is active and blocks aio_laundry_combo.json', () => {
  const contract = readJson('CG_AIO_LAUNDRY_COMBO_FIT_TEST_CONTRACT_v1.json');

  assert.equal(contract.workstream, 'CG-AIO-LAUNDRY-COMBO-FIT-TEST');
  assert.equal(contract.status, 'active');
  assert.ok((contract.notCreating as string[]).includes('aio_laundry_combo.json'));
  assert.ok(
    (contract.notCreating as string[]).includes('mutations to front_load_washer.json'),
  );
  assert.ok((contract.notCreating as string[]).includes('mutations to vented_dryer.json'));
  assert.equal((contract.successCriteria as { canonicalExpansion: number }).canonicalExpansion, 0);
});

test('AIO fit-test: fit phase blocked aio_laundry_combo.json; frozen laundry hashes unchanged', () => {
  const contract = readJson('CG_AIO_LAUNDRY_COMBO_FIT_TEST_CONTRACT_v1.json');
  assert.ok((contract.notCreating as string[]).includes('aio_laundry_combo.json'));

  for (const [family, expectedHash] of Object.entries(FROZEN_HASHES)) {
    const actualHash = sha256File(join(CANONICAL, `${family}.json`));
    assert.equal(actualHash, expectedHash, `${family} hash must be unchanged`);
  }
});

test('AIO WD53 observation: all procedures classified with provenance', () => {
  const observation = readJson('CG_AIO_WD53DBA900_FIT_OBSERVATION_v1.json');
  const procedures = observation.procedureClassifications as Array<{
    procedureId: string;
    classification: string;
    provenance: string;
  }>;

  assert.equal(procedures.length, 21);
  for (const proc of procedures) {
    assert.ok(
      (APPROVED_CLASSIFICATIONS as readonly string[]).includes(proc.classification),
      `${proc.procedureId} uses approved vocabulary`,
    );
    assert.ok(proc.provenance && proc.provenance.length > 0, `${proc.procedureId} has provenance`);
  }

  const histogram = observation.classificationHistogram as Record<string, number>;
  const histogramSum = Object.values(histogram).reduce((a, b) => a + b, 0);
  assert.equal(histogramSum, 21);
  assert.equal(histogram.vented_dryer, 0, 'no dry procedure maps to vented_dryer without forcing');
});

test('AIO fit analysis: exactly one hard outcome — architectural_divergence', () => {
  const analysis = readJson('CG_AIO_LAUNDRY_COMBO_FIT_ANALYSIS_v1.json');

  assert.ok((PERMITTED_OUTCOMES as readonly string[]).includes(analysis.hardOutcome as string));
  assert.equal(analysis.hardOutcome, 'architectural_divergence');
  assert.equal(
    (analysis.hardOutcomeGate as { exactlyOne: boolean }).exactlyOne,
    true,
  );
  assert.equal((analysis.headlineMetrics as { canonicalExpansion: number }).canonicalExpansion, 0);
  assert.equal(
    (analysis.headlineMetrics as { aioLaundryComboJsonCreated: boolean }).aioLaundryComboJsonCreated,
    false,
  );
  assert.equal((analysis.headlineMetrics as { overlayCreated: boolean }).overlayCreated, false);
});

test('AIO fit-test: no closure artifact — divergence package awaits human gate', () => {
  assert.equal(
    existsSync(join(CALIBRATION, 'CG_AIO_LAUNDRY_COMBO_FIT_CLOSURE_v1.json')),
    false,
  );

  const divergence = readJson('CG_AIO_LAUNDRY_COMBO_FIT_DIVERGENCE_PACKAGE_v1.json');
  assert.equal(divergence.fitOutcome, 'architectural_divergence');
  assert.equal(divergence.status, 'awaiting_human_authorization');
  assert.equal(
    (divergence.authorizationRequestedFor as string),
    'CG-AIO-LAUNDRY-COMBO-DISCOVERY',
  );
  assert.equal((divergence.canonicalExpansionCount as number), 0);
});

test('AIO triangulation documents single-witness limitation', () => {
  const triangulation = readJson('CG_AIO_LAUNDRY_COMBO_FIT_TRIANGULATION_v1.json');

  assert.equal(triangulation.witnessCount, 1);
  assert.equal(triangulation.crossManufacturerTriangulation, false);
  assert.ok((triangulation.limitation as { statement: string }).statement.includes('one ingested'));
  assert.equal(
    (triangulation.triangulationVerdict as { recommendAnalysisOutcome: string })
      .recommendAnalysisOutcome,
    'architectural_divergence',
  );
});

test('AIO fit contract functional domains and heat-pump guard are internally consistent', () => {
  const contract = readJson('CG_AIO_LAUNDRY_COMBO_FIT_TEST_CONTRACT_v1.json');
  const domains = contract.functionalDomainsUnderTest as {
    washing: string[];
    drying: string[];
    sharedIntegration: string[];
  };

  assert.ok(domains.washing.length >= 10);
  assert.ok(domains.drying.length >= 7);
  assert.ok(domains.sharedIntegration.length >= 8);
  assert.ok(
    (contract.hardGateRule as { heatPumpVentlessGuard: string }).heatPumpVentlessGuard.includes(
      'vented_dryer',
    ),
  );

  const w1 = (contract.discoveryCorpus as { W1: { procedureCount: number } }).W1;
  assert.equal(w1.procedureCount, 21);
});
