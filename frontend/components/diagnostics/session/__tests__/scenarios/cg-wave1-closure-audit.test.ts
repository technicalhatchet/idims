import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const WAVES = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/review/waves',
);
const DECISIONS = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/review/CG_PRODUCTION_NORMALIZATION_CANDIDATE_REVIEW_DECISIONS_v1.json',
);
const INDEX = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/review/CG_PRODUCTION_NORMALIZATION_CANDIDATE_REVIEW_INDEX_v1.json',
);

test('wave1 closure audit artifact reports WAVE1_CLOSED with exact counts', () => {
  const path = join(WAVES, 'CG_WAVE1_EXISTING_CANONICAL_MAPPING_CLOSURE_AUDIT_v1.json');
  assert.ok(existsSync(path), 'run backend/scripts/run_wave1_closure_audit.py to generate closure audit');
  const audit = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(audit.status, 'WAVE1_CLOSED');
  assert.equal(audit.expectedCount, 370);
  assert.equal(audit.reviewedCount, 370);
  assert.equal(audit.acceptedCount, 328);
  assert.equal(audit.deferredCount, 41);
  assert.equal(audit.rejectedCount, 1);
  assert.equal(audit.decisionReconciliation.missingDecisionCount, 0);
  assert.equal(audit.decisionReconciliation.outOfWaveDecisionCount, 0);
});

test('wave1 supply mapping audit captures supply vs power_supply split', () => {
  const path = join(WAVES, 'CG_WAVE1_EXISTING_CANONICAL_MAPPING_CLOSURE_AUDIT_v1.json');
  assert.ok(existsSync(path));
  const audit = JSON.parse(readFileSync(path, 'utf8'));
  const supply = audit.rejectedMappingAnalysis.wave1SupplyOccurrences;
  assert.equal(supply.totalWithSourceTermSupply, 36);
  assert.equal(supply.supplyToSupplyCount, 6);
  assert.equal(supply.supplyToPowerSupplyCount, 30);
});

test('wave1 closure frozen hash validation passes in audit artifact', () => {
  const path = join(WAVES, 'CG_WAVE1_EXISTING_CANONICAL_MAPPING_CLOSURE_AUDIT_v1.json');
  assert.ok(existsSync(path));
  const audit = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(audit.frozenHashValidation.passed, true);
  assert.equal(audit.canonicalMutationCheck.passed, true);
  assert.equal(audit.decisionIntegrity.promotionExcluded, true);
});

test('decisions artifact remains review-only at wave1 scale', () => {
  const store = JSON.parse(readFileSync(DECISIONS, 'utf8'));
  assert.equal(Object.keys(store.decisions).length, 370);
  assert.equal(store.promotionExplicitlyExcluded, undefined);
  assert.ok(!('promotionApplied' in store));
  const index = JSON.parse(readFileSync(INDEX, 'utf8'));
  assert.equal(index.promotionExplicitlyExcluded, true);
});
