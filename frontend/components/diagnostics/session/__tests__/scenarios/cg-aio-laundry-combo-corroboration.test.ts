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
} as const;

const CORROBORATION_CLASSIFICATIONS = [
  'independently_corroborated',
  'partially_corroborated',
  'not_corroborated',
  'implementation_specific',
  'unresolved',
] as const;

function sha256File(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(CALIBRATION, name), 'utf8'));
}

test('Whirlpool corroboration observation is independent with provenance', () => {
  const whirlpool = readJson('CG_AIO_WFW9620_CORROBORATION_OBSERVATION_v1.json');

  assert.equal(whirlpool.manufacturer, 'Whirlpool');
  assert.equal(whirlpool.manualId, 'W11169652');
  assert.equal(whirlpool.aioQualification.qualifiesAsAioWitness, true);
  assert.equal(whirlpool.dryingArchitecture.heatPumpRefrigeration, false);
  assert.equal(whirlpool.dryingArchitecture.ventedVsVentless, 'ventless_condenser');
  assert.equal(whirlpool.samsungCandidateNotConsultedDuringDerivation, true);
  assert.ok(whirlpool.sourcePdf.includes('w11169652'));
  assert.ok(
    (whirlpool.washingArchitecture.frontLoadWasherFit as { mutationRequired: boolean })
      .mutationRequired === false,
  );
});

test('Samsung fit observation unchanged — corroboration did not mutate W1', () => {
  const samsung = readJson('CG_AIO_WD53DBA900_FIT_OBSERVATION_v1.json');
  assert.equal(samsung.manufacturer, 'Samsung');
  assert.equal(samsung.witnessId, 'W1');
  assert.equal(samsung.classificationHistogram.vented_dryer, 0);
  assert.equal(samsung.dryingArchitecture, 'heat_pump_ventless_condenser');
});

test('Corroboration: orchestration independently corroborated; sealed dry partially corroborated', () => {
  const corroboration = readJson('CG_AIO_LAUNDRY_COMBO_CORROBORATION_v1.json');
  const comparison = corroboration.comparisonAgainstCandidate as Record<
    string,
    { classification: string }
  >;

  assert.equal(corroboration.candidateModified, false);
  assert.equal(corroboration.witnesses.length, 2);
  assert.equal(
    comparison.integrated_laundry_orchestration.classification,
    'independently_corroborated',
  );
  assert.equal(comparison.sealed_heat_pump_drying.classification, 'partially_corroborated');
  assert.equal(
    comparison.reused_front_load_washer_domains.classification,
    'independently_corroborated',
  );

  for (const cls of Object.values(comparison).map((c) => c.classification)) {
    assert.ok((CORROBORATION_CLASSIFICATIONS as readonly string[]).includes(cls));
  }
});

test('Corroboration: historical governance — no freeze at corroboration time; frozen sources unchanged', () => {
  const candidate = readJson('aio_laundry_combo_functional_contract_candidate_v1.json');
  assert.equal(candidate.notCanonicalFile, true);
  assert.equal(candidate.status, 'candidate_ready_for_freeze_review');

  const corroboration = readJson('CG_AIO_LAUNDRY_COMBO_CORROBORATION_v1.json');
  assert.equal(
    (corroboration.governance as { canonicalExpansion: number }).canonicalExpansion,
    0,
  );
  assert.equal(
    (corroboration.governance as { aioLaundryComboJsonCreated: boolean }).aioLaundryComboJsonCreated,
    false,
  );
  assert.equal((corroboration.governance as { freezeExecuted: boolean }).freezeExecuted, false);
  assert.equal(
    (corroboration.governance as { samsungEvidenceMutated: boolean }).samsungEvidenceMutated,
    false,
  );

  for (const [family, expectedHash] of Object.entries(FROZEN_HASHES)) {
    assert.equal(sha256File(join(CANONICAL, `${family}.json`)), expectedHash);
  }
});

test('Whirlpool qualifies as AIO — not stacked, FlexWash, or standalone dryer', () => {
  const whirlpool = readJson('CG_AIO_WFW9620_CORROBORATION_OBSERVATION_v1.json');
  const qual = whirlpool.aioQualification as Record<string, boolean | string>;

  assert.equal(qual.qualifiesAsAioWitness, true);
  assert.ok(qual.notStackedLaundry);
  assert.ok(qual.notFlexWashDualLoad);
  assert.ok(qual.notStandaloneDryer);
  assert.equal(whirlpool.modelNomenclature.productCode, 'C = All-In-One');
});

test('AIO corroboration artifact preserved — return incorporated in workstream status', () => {
  const status = readJson('CG_AIO_LAUNDRY_COMBO_WORKSTREAM_STATUS_v1.json');
  assert.equal((status.corroborationStatus as { state: string }).state, 'COMPLETE');
  assert.equal((status.returnStatus as { state: string }).state, 'COMPLETE');

  const corroboration = readJson('CG_AIO_LAUNDRY_COMBO_CORROBORATION_v1.json');
  assert.equal(corroboration.candidateModified, false);
});

test('Corroboration documents dry architecture divergence without disproving new family', () => {
  const corroboration = readJson('CG_AIO_LAUNDRY_COMBO_CORROBORATION_v1.json');
  const sealed = (
    corroboration.comparisonAgainstCandidate as {
      sealed_heat_pump_drying: {
        candidateNameConcern: { doesNotDisproveNeedForNewFamily: boolean };
      };
    }
  ).sealed_heat_pump_drying;

  assert.equal(sealed.candidateNameConcern.doesNotDisproveNeedForNewFamily, true);
  assert.equal(
    (corroboration.corroborationVerdict as { candidateNotAutoModified: boolean })
      .candidateNotAutoModified,
    true,
  );
});
