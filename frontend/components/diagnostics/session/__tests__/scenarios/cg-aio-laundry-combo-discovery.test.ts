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
  microwave: '3c9ef98e07c0b87d5f3ea9e313deb21892d75fd563bff397a0cc33aba55e533d',
  range_oven: 'e29bb5fafe2afacdba3b45a1ec8e4ec0b73c78d51ff6319bb6a7c0e20a7b4fc5',
} as const;

const PERMITTED_DISCOVERY_OUTCOMES = [
  'candidate_ready_for_freeze',
  'discovery_insufficient',
  'existing_family_can_be_extended',
] as const;

function sha256File(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(CALIBRATION, name), 'utf8'));
}

test('AIO discovery contract is active with human authorization and blocks canonical creation', () => {
  const contract = readJson('CG_AIO_LAUNDRY_COMBO_DISCOVERY_CONTRACT_v1.json');

  assert.equal(contract.workstream, 'CG-AIO-LAUNDRY-COMBO-DISCOVERY');
  assert.equal(contract.status, 'active');
  assert.ok((contract.notCreating as string[]).includes('aio_laundry_combo.json'));
  assert.ok((contract.notCreating as string[]).includes('mutations to vented_dryer.json'));
  assert.equal(
    (contract.singleWitnessDiscipline as { corroborationStatus: string }).corroborationStatus,
    'insufficient_corpus_evidence',
  );
  assert.equal(
    (contract.corpusSearch as { corroborationStatus: string }).corroborationStatus,
    'insufficient_corpus_evidence',
  );
});

test('AIO discovery: discovery phase blocked canonical authoring; frozen hashes unchanged', () => {
  const contract = readJson('CG_AIO_LAUNDRY_COMBO_DISCOVERY_CONTRACT_v1.json');
  assert.ok((contract.notCreating as string[]).includes('aio_laundry_combo.json'));

  for (const [family, expectedHash] of Object.entries(FROZEN_HASHES)) {
    const actualHash = sha256File(join(CANONICAL, `${family}.json`));
    assert.equal(actualHash, expectedHash, `${family} hash must be unchanged`);
  }
});

test('AIO discovery closure preserved historical single-witness candidate', () => {
  const closure = readJson('CG_AIO_LAUNDRY_COMBO_DISCOVERY_CLOSURE_v1.json');
  assert.equal(closure.discoveryOutcome, 'candidate_ready_for_freeze');
  assert.equal(
    (closure.approvedFunctionalContract as { newCoreFunctions: number }).newCoreFunctions,
    2,
  );
  assert.equal(
    (closure.discoveryDecisions as { dryPath: string }).dryPath,
    'NEW sealed_heat_pump_drying — vented_dryer extension rejected',
  );
  assert.equal(closure.corroborationStatus, 'insufficient_corpus_evidence');
});

test('AIO discovery: implementation components not silently promoted at discovery time', () => {
  const closure = readJson('CG_AIO_LAUNDRY_COMBO_DISCOVERY_CLOSURE_v1.json');
  const decisions = closure.discoveryDecisions as Record<string, string>;
  assert.ok(decisions.compressor_condenser_evaporator.includes('REJECTED'));
});

test('AIO discovery closure: candidate_ready_for_freeze — STOP before freeze', () => {
  const closure = readJson('CG_AIO_LAUNDRY_COMBO_DISCOVERY_CLOSURE_v1.json');

  assert.ok(
    (PERMITTED_DISCOVERY_OUTCOMES as readonly string[]).includes(
      closure.discoveryOutcome as string,
    ),
  );
  assert.equal(closure.discoveryOutcome, 'candidate_ready_for_freeze');
  assert.equal(
    (closure.governanceConclusion as { aioLaundryComboJsonCreated: boolean })
      .aioLaundryComboJsonCreated,
    false,
  );
  assert.equal((closure.governanceConclusion as { freezeExecuted: boolean }).freezeExecuted, false);
  assert.equal(
    (closure.governanceConclusion as { canonicalExpansion: number }).canonicalExpansion,
    0,
  );
  assert.equal(closure.stopCondition, 'STOP — await human architectural gate for freeze authorization');
});

test('AIO candidate reuses front_load_washer wash domains — vented_dryer rejected', () => {
  const candidate = readJson('aio_laundry_combo_functional_contract_candidate_v1.json');
  const reused = candidate.reusedExistingCanonicalDomains as {
    frontLoadWasher: { hostFamily: string; domainsReusedUnchanged: unknown[] };
    ventedDryerRejected: { reuseMode: string };
  };

  assert.equal(reused.frontLoadWasher.hostFamily, 'front_load_washer');
  assert.ok(reused.frontLoadWasher.domainsReusedUnchanged.length >= 6);
  assert.equal(reused.ventedDryerRejected.reuseMode, 'none');

  const fit = readJson('CG_AIO_LAUNDRY_COMBO_FIT_ANALYSIS_v1.json');
  assert.equal(fit.hardOutcome, 'architectural_divergence');
});

test('AIO discovery closure historical — freeze executed in separate authorized gate', () => {
  const discoveryClosure = readJson('CG_AIO_LAUNDRY_COMBO_DISCOVERY_CLOSURE_v1.json');
  assert.equal(
    (discoveryClosure.governanceConclusion as { freezeExecuted: boolean }).freezeExecuted,
    false,
  );
  assert.equal(existsSync(join(CALIBRATION, 'CG_AIO_LAUNDRY_COMBO_FREEZE_CONTRACT_v1.json')), true);
  assert.equal(existsSync(join(CALIBRATION, 'CG_AIO_LAUNDRY_COMBO_FIT_CLOSURE_v1.json')), false);
});
