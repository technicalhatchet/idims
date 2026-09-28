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
  microwave: '3c9ef98e07c0b87d5f3ea9e313deb21892d75fd563bff397a0cc33aba55e533d',
  french_door_refrigerator: 'adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9',
  vented_dryer: 'db48a9a1271843fc63d871330c633f468c537fc14242c8d537e611375992b714',
  heat_pump_dryer: 'd7a98c826d011a9fdef4b8c91ebd4d66ff88629f7d7b91357d43fee42c32d3bb',
  aio_laundry_combo: 'be3799a991b3d778b62e60a7ec3d91dfd6fe82432e3f9ac8663d607008081183',
  front_load_washer: '9fed1c36b985f32da8107382cb0cab8e65c509f8cdea7ac72631718b82f99c05',
} as const;

const PRODUCT_CONFIG_GRAPHS = [
  'cooktop.json',
  'wall_oven.json',
  'standalone_freezer.json',
  'stacked_laundry_center.json',
] as const;

function sha256File(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(CALIBRATION, name), 'utf8'));
}

test('canonical architecture complete lock — GREEN with zero expansion', () => {
  const lock = readJson('CG_CANONICAL_ARCHITECTURE_COMPLETE_LOCK_v1.json');
  const closure = readJson('CG_CANONICAL_ARCHITECTURE_COMPLETE_CLOSURE_v1.json');

  assert.equal(lock.verdict, 'CLOSED / CANONICAL_ARCHITECTURE_COMPLETE');
  assert.equal(closure.verdict, 'GREEN / CANONICAL_ARCHITECTURE_COMPLETE');
  assert.equal((lock.headlineMetrics as { canonicalExpansionAtArchitectureComplete: number }).canonicalExpansionAtArchitectureComplete, 0);
  assert.equal((lock.headlineMetrics as { canonicalHashMutations: number }).canonicalHashMutations, 0);
  assert.equal((closure.governanceConclusion as { normalizationAuthorized: boolean }).normalizationAuthorized, false);
  assert.equal((closure.governanceConclusion as { unresolvedFitGates: number }).unresolvedFitGates, 0);
});

test('all inventory fit gates resolved — cooktop is final composition gate', () => {
  const lock = readJson('CG_CANONICAL_ARCHITECTURE_COMPLETE_LOCK_v1.json');
  const resolutions = lock.inventoryFitGateResolutions as Array<{
    categoryId: string;
    outcome: string;
    host?: string;
  }>;

  assert.ok(resolutions.length >= 7);
  const cooktop = resolutions.find((entry) => entry.categoryId === 'cooktop_only');
  assert.equal(cooktop?.outcome, 'composition');
  assert.equal(cooktop?.host, 'range_oven');

  const wallOven = resolutions.find((entry) => entry.categoryId === 'wall_oven');
  assert.equal(wallOven?.outcome, 'composition');
  assert.equal(wallOven?.host, 'range_oven');
});

test('product-configuration graphs not created', () => {
  for (const graph of PRODUCT_CONFIG_GRAPHS) {
    assert.equal(existsSync(join(CANONICAL, graph)), false, `${graph} must not exist`);
  }
});

test('frozen canonical graph hashes unchanged at architecture complete', () => {
  for (const [family, expectedHash] of Object.entries(FROZEN_HASHES)) {
    const actualHash = sha256File(join(CANONICAL, `${family}.json`));
    assert.equal(actualHash, expectedHash, `${family} hash must be unchanged`);
  }
});

test('architecture complete — STOP; normalization not authorized; successor is governance', () => {
  const closure = readJson('CG_CANONICAL_ARCHITECTURE_COMPLETE_CLOSURE_v1.json');
  const lock = readJson('CG_CANONICAL_ARCHITECTURE_COMPLETE_LOCK_v1.json');

  assert.equal(closure.authorizedNextWorkstream, 'CG-PRODUCTION-INGESTION-GOVERNANCE');
  assert.equal(lock.authorizedNextWorkstream, null);
  assert.equal((closure.handoff as { authorized: boolean }).authorized, false);
  assert.match(closure.stopCondition as string, /STOP/i);
});

test('cooktop fit closure chains to architecture complete', () => {
  const cooktopClosure = readJson('CG_COOKTOP_FIT_CLOSURE_v1.json');
  assert.equal(cooktopClosure.authorizedNextWorkstream, 'CG-CANONICAL-ARCHITECTURE-COMPLETE');

  const archClosure = readJson('CG_CANONICAL_ARCHITECTURE_COMPLETE_CLOSURE_v1.json');
  assert.equal(archClosure.priorGate, 'CG_COOKTOP_FIT_CLOSURE_v1.json');
});
