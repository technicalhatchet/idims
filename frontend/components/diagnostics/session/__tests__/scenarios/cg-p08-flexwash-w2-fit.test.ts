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
const CANDIDATES = join(process.cwd(), 'components/diagnostics/knowledge/normalization/candidates');
const REPO_ROOT = resolve(process.cwd(), '..');

const FIT_CLASSIFICATIONS = [
  'FITS_EXISTING_INSTANCE',
  'FITS_MULTI_INSTANCE',
  'FITS_INTEGRATION_DOMAIN',
  'DOES_NOT_FIT',
  'INSUFFICIENT_EVIDENCE',
] as const;

const CORROBORATION_OUTCOMES = [
  'W2_CORROBORATES_MODEL',
  'W2_PARTIALLY_CORROBORATES',
  'W2_FALSIFIES_MODEL',
  'W2_NOT_COMPARABLE',
  'W2_INSUFFICIENT_EVIDENCE',
] as const;

function sha256File(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(CALIBRATION, name), 'utf8'));
}

test('W2 fit observation: WV60 witness with comparability and corroboration outcome', () => {
  const w2 = readJson('CG_P08_FLEXWASH_W2_FIT_OBSERVATION_v1.json');

  assert.equal(w2.workstream, 'CG-P08-FLEXWASH-W2-FIT');
  assert.equal((w2.witnessIdentity as { id: string }).id, 'W2');
  assert.equal((w2.comparabilityAssessment as { verdict: string }).verdict, 'COMPARABLE');
  assert.equal(
    (w2.comparabilityAssessment as { integratedDualCompartment: boolean }).integratedDualCompartment,
    true,
  );
  assert.ok(
    (CORROBORATION_OUTCOMES as readonly string[]).includes(w2.corroborationOutcome as string),
  );
  assert.equal(w2.corroborationOutcome, 'W2_PARTIALLY_CORROBORATES');
  assert.equal(
    (w2.freezeReadiness as { verdict: string }).verdict,
    'READY_FOR_HUMAN_FREEZE_DECISION',
  );
  assert.equal(w2.humanDecisionRequired, true);
  assert.equal((w2.gateStatus as { freezeAuthorized: boolean }).freezeAuthorized, false);
});

test('W2 fit observation: all manual functions classified with required fields', () => {
  const w2 = readJson('CG_P08_FLEXWASH_W2_FIT_OBSERVATION_v1.json');
  const matrix = w2.procedureFitMatrix as Array<{
    functionId: string;
    classification: string;
    evidence: string;
    confidence: string;
  }>;

  assert.equal(matrix.length, 22);
  for (const row of matrix) {
    assert.ok(
      (FIT_CLASSIFICATIONS as readonly string[]).includes(row.classification),
      `${row.functionId} uses approved fit classification`,
    );
    assert.ok(row.evidence.length > 0, `${row.functionId} has evidence`);
    assert.ok(row.confidence.length > 0, `${row.functionId} has confidence`);
  }

  const ac7Row = matrix.find((r) => r.functionId === 'wv60-interload-communication');
  assert.ok(ac7Row);
  assert.equal(ac7Row.classification, 'INSUFFICIENT_EVIDENCE');

  const sfRow = matrix.find((r) => r.functionId === 'wv60-system-fault');
  assert.ok(sfRow);
  assert.equal(sfRow.classification, 'FITS_INTEGRATION_DOMAIN');
});

test('W2 fit: SF converges, AC7 does not — W1 fit test unchanged', () => {
  const w2 = readJson('CG_P08_FLEXWASH_W2_FIT_OBSERVATION_v1.json');
  const w1 = readJson('CG_P08_FLEXWASH_FIT_TEST_v1.json');

  assert.equal((w2.sfFit as { converges: boolean }).converges, true);
  assert.equal((w2.ac7Fit as { w2EquivalentFound: boolean }).w2EquivalentFound, false);
  assert.equal((w2.simultaneousOperationEvidence as { proven: boolean }).proven, false);

  assert.equal((w1.witness as { id: string }).id, 'W1');
  assert.equal((w1.fitSummary as { fitResult: string }).fitResult, 'partially_fits');
});

test('W2 fit: no canonical mutation — frozen hashes and P08 exception preserved', () => {
  const w2 = readJson('CG_P08_FLEXWASH_W2_FIT_OBSERVATION_v1.json');
  const forbidden = w2.forbiddenActionsConfirmed as Record<string, boolean>;

  assert.equal(forbidden.canonicalJsonMutated, false);
  assert.equal(forbidden.architectureExceptionResolved, false);
  assert.equal(forbidden.p08Closed, false);

  const registry = readJson('frozen_canonical_hashes_v1.json');
  const frozen = registry.frozenOntologies as Record<string, { file: string; hash: string }>;
  for (const [, entry] of Object.entries(frozen)) {
    const path = join(REPO_ROOT, entry.file);
    assert.equal(sha256File(path), entry.hash);
  }

  const exceptionPath = join(
    CANDIDATES,
    'SAMSUNG-FLEXWASH-WASHER',
    'architecture_exception.json',
  );
  assert.ok(existsSync(exceptionPath));
  const exception = JSON.parse(readFileSync(exceptionPath, 'utf8'));
  assert.equal(exception.batchDisposition, 'STOP');
  assert.equal(exception.exceptionType, 'architecture_conflict');
});

test('W2 fit: WV60 manual extract exists in corpus', () => {
  const w2 = readJson('CG_P08_FLEXWASH_W2_FIT_OBSERVATION_v1.json');
  const witness = w2.witnessIdentity as { manualSource: string; extractedText: string };

  assert.ok(existsSync(join(REPO_ROOT, witness.manualSource)));
  assert.ok(existsSync(join(REPO_ROOT, witness.extractedText)));
});
