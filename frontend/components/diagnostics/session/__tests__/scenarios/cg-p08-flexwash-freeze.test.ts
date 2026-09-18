import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import { PLATFORM_RULES, resolvePlatformId } from '../../../knowledge/platformRegistry';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const CANONICAL = resolve(process.cwd(), 'components/diagnostics/knowledge/canonical');
const CANDIDATES = join(process.cwd(), 'components/diagnostics/knowledge/normalization/candidates');
const REPO_ROOT = resolve(process.cwd(), '..');

const FROZEN_CONTRACT_HASH =
  'af4fa710941c9bb26dc802de390d1f4c9dcc09106c04da6fb5f6be84651950d3';

const FROZEN_FRONT_LOAD_WASHER_HASH =
  '9fed1c36b985f32da8107382cb0cab8e65c509f8cdea7ac72631718b82f99c05';

const EVIDENCE_STATUSES = {
  system_supervision: 'FROZEN / CORROBORATED',
  inter_instance_control_communication: 'FROZEN / W1_DERIVED',
  wv60_ac7: 'UNDOCUMENTED',
  enable_inhibit: 'FROZEN_FACET',
  simultaneous_active_wash: 'NOT_PROVEN',
} as const;

const REJECTED_CANONICAL_IDS = [
  'dual_load_integrated_orchestration',
  'dual_compartment_partition',
  'integrated_laundry_orchestration',
];

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(CALIBRATION, name), 'utf8'));
}

test('P08 freeze contract, lock, audit, closure — GREEN integration boundary frozen', () => {
  const contract = readJson('CG_P08_FLEXWASH_FREEZE_CONTRACT_v1.json');
  const lock = readJson('CG_P08_FLEXWASH_FREEZE_LOCK_v1.json');
  const audit = readJson('CG_P08_FLEXWASH_FREEZE_AUDIT_v1.json');
  const closure = readJson('CG_P08_FLEXWASH_FREEZE_CLOSURE_v1.json');

  assert.equal(contract.closureVerdict, 'GREEN / P08_FLEXWASH_INTEGRATION_BOUNDARY_FROZEN');
  assert.equal(lock.verdict, 'CLOSED / P08_FLEXWASH_INTEGRATION_BOUNDARY_FROZEN');
  assert.equal(audit.verdict, 'GREEN');
  assert.equal(closure.verdict, 'GREEN / P08_FLEXWASH_INTEGRATION_BOUNDARY_FROZEN');
  assert.equal(contract.successCriteria.canonicalExpansion, 0);
  assert.equal(contract.successCriteria.newCanonicalFamilyFile, false);
  assert.equal(contract.successCriteria.humanFreezeApprovalStatus, 'approved');
});

test('frozen integration contract encodes all six human evidence statuses', () => {
  const frozen = readJson('flexwash_integration_boundary_functional_contract_frozen_v1.json');
  const statuses = frozen.explicitEvidenceStatuses as Record<string, string>;

  assert.equal(frozen.status, 'frozen');
  assert.equal(frozen.notCanonicalFile, true);
  assert.deepEqual(statuses, EVIDENCE_STATUSES);

  const wv60 = frozen.wv60Ac7Status as { verdict: string; notAbsent: boolean };
  assert.equal(wv60.verdict, 'UNDOCUMENTED');
  assert.equal(wv60.notAbsent, true);

  const simultaneous = frozen.simultaneousActiveWash as {
    status: string;
    canonicalCapabilityCreated: boolean;
  };
  assert.equal(simultaneous.status, 'NOT_PROVEN');
  assert.equal(simultaneous.canonicalCapabilityCreated, false);

  const enableInhibit = (frozen.frozenIntegrationFunctions as Array<{ id: string; isCanonicalNode?: boolean }>).find(
    (f) => f.id === 'enable_inhibit',
  );
  assert.ok(enableInhibit);
  assert.equal(enableInhibit?.isCanonicalNode, false);
});

test('system_supervision corroborated; AC7 W1_DERIVED only — not universal', () => {
  const frozen = readJson('flexwash_integration_boundary_functional_contract_frozen_v1.json');
  const functions = frozen.frozenIntegrationFunctions as Array<{
    id: string;
    evidenceStatus: string;
    w2Corroboration?: boolean;
  }>;

  const sf = functions.find((f) => f.id === 'system_supervision');
  const ac7 = functions.find((f) => f.id === 'inter_instance_control_communication');

  assert.equal(sf?.evidenceStatus, 'CORROBORATED');
  assert.equal(ac7?.evidenceStatus, 'W1_DERIVED');
  assert.equal(ac7?.w2Corroboration, false);
});

test('no new canonical family file; rejected orchestration ids absent from canonical/', () => {
  for (const id of [
    'dual_load_washer.json',
    'flexwash.json',
    'dual_compartment_integration.json',
    'dual_load_integrated_orchestration.json',
  ]) {
    assert.equal(existsSync(join(CANONICAL, id)), false, `${id} must not exist`);
  }

  const frozen = readJson('flexwash_integration_boundary_functional_contract_frozen_v1.json');
  const rejected = frozen.rejectedAtFreeze as string[];
  for (const id of REJECTED_CANONICAL_IDS) {
    assert.ok(rejected.some((r) => r.includes(id.replace(/_/g, '_')) || r.includes(id)));
  }
});

test('frozen contract hash matches lock; front_load_washer hash unchanged', () => {
  const lock = readJson('CG_P08_FLEXWASH_FREEZE_LOCK_v1.json');
  const contractPath = join(CALIBRATION, 'flexwash_integration_boundary_functional_contract_frozen_v1.json');

  assert.equal(sha256File(contractPath), FROZEN_CONTRACT_HASH);
  assert.equal((lock.frozenContract as { hash: string }).hash, FROZEN_CONTRACT_HASH);
  assert.equal(
    sha256File(join(CANONICAL, 'front_load_washer.json')),
    FROZEN_FRONT_LOAD_WASHER_HASH,
  );

  const registry = readJson('frozen_canonical_hashes_v1.json');
  const frozen = registry.frozenOntologies as Record<string, { file: string; hash: string }>;
  for (const [, entry] of Object.entries(frozen)) {
    assert.equal(sha256File(join(REPO_ROOT, entry.file)), entry.hash);
  }
});

test('architecture_exception.json preserved as historical STOP evidence', () => {
  const exceptionPath = join(
    CANDIDATES,
    'SAMSUNG-FLEXWASH-WASHER',
    'architecture_exception.json',
  );
  assert.ok(existsSync(exceptionPath));

  const exception = JSON.parse(readFileSync(exceptionPath, 'utf8'));
  assert.equal(exception.batchDisposition, 'STOP');
  assert.equal(exception.exceptionType, 'architecture_conflict');
  assert.ok(String(exception.reason).toLowerCase().includes('dual-load'));

  const audit = readJson('CG_P08_FLEXWASH_FREEZE_AUDIT_v1.json');
  assert.equal(
    (audit.architectureExceptionProvenance as { preserved: boolean }).preserved,
    true,
  );
  assert.equal((audit.architectureExceptionProvenance as { deleted: boolean }).deleted, false);
});

test('WV60 registered as platform generation — registry metadata only', () => {
  const wv60 = readJson('CG_P08_FLEXWASH_WV60_PLATFORM_GENERATION_v1.json');
  assert.equal(wv60.platformId, 'samsung_flexwash');
  assert.equal((wv60.registryChanges as { canonicalMutation: boolean }).canonicalMutation, false);
  assert.equal((wv60.registryChanges as { newCanonicalFamilyFile: boolean }).newCanonicalFamilyFile, false);
  assert.equal(wv60.wv60Ac7InManual, 'UNDOCUMENTED — not absent');

  const flexRule = PLATFORM_RULES.find((r) => r.id === 'samsung_flexwash');
  assert.ok(flexRule);
  assert.ok(flexRule.modelPatterns?.some((p) => p.test('WV60M9900AV')));
  assert.ok(flexRule.modelPatterns?.some((p) => p.test('WV55M9600AV')));

  assert.equal(
    resolvePlatformId({
      equipmentMake: 'Samsung',
      equipmentModel: 'WV60M9900AV/A5',
      templateId: 'washer',
    }),
    'samsung_flexwash',
  );
});

test('W1/W2 fit artifacts preserved — freeze did not mutate evidence', () => {
  const w1 = readJson('CG_P08_FLEXWASH_FIT_TEST_v1.json');
  const w2 = readJson('CG_P08_FLEXWASH_W2_FIT_OBSERVATION_v1.json');

  assert.equal((w1.witness as { id: string }).id, 'W1');
  assert.equal(w2.corroborationOutcome, 'W2_PARTIALLY_CORROBORATES');
  assert.equal((w2.ac7Fit as { w2EquivalentFound: boolean }).w2EquivalentFound, false);
});
