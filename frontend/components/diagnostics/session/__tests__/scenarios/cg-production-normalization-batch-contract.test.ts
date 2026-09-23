import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const CANDIDATES = join(process.cwd(), 'components/diagnostics/knowledge/normalization/candidates');
const REPO_ROOT = resolve(process.cwd(), '..');

const PRIMARY_DISPOSITION_VALUES = [
  'canonical_mapping',
  'implementation_specific',
  'unresolved',
  'architecture_exception',
  'prerequisite_block',
  'pending',
  'skipped_authorized',
] as const;

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(CALIBRATION, name), 'utf8'));
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('batch contract defined — execution NOT authorized', () => {
  const contract = readJson('CG_PRODUCTION_NORMALIZATION_BATCH_CONTRACT_v1.json');
  const lock = readJson('CG_PRODUCTION_NORMALIZATION_BATCH_LOCK_v1.json');
  const audit = readJson('CG_PRODUCTION_NORMALIZATION_BATCH_AUDIT_v1.json');

  assert.equal(contract.status, 'defined_not_executed');
  assert.equal(contract.workstream, 'CG-PRODUCTION-NORMALIZATION-BATCH');
  assert.equal(lock.verdict, 'ACTIVE / BATCH_CONTRACT_DEFINED — EXECUTION NOT AUTHORIZED');
  assert.equal((lock.headlineMetrics as { batchExecutionAuthorized: boolean }).batchExecutionAuthorized, false);
  assert.equal(audit.batchExecutionAuthorized, false);
  assert.equal(audit.verdict, 'GREEN / BATCH_CONTRACT_DEFINED');

  const notAuth = contract.notAuthorizingYet as string[];
  assert.ok(notAuth.some((item) => item.includes('Batch execution')));
  assert.ok(notAuth.some((item) => item.includes('FlexWash')));
  assert.ok(notAuth.some((item) => item.includes('automatic')));
});

test('batch cohort manifest — 72 manuals with provenance fields', () => {
  const cohort = readJson('CG_PRODUCTION_NORMALIZATION_BATCH_COHORT_v1.json');
  const entries = cohort.entries as Array<{
    manualId: string;
    platformId: string;
    templateId: string;
    provenance: { manifestSource: string };
  }>;

  assert.equal(cohort.status, 'defined_not_executed');
  assert.equal(cohort.cohortSize, 72);
  assert.equal(entries.length, 72);

  for (const entry of entries) {
    assert.ok(entry.manualId.length > 0);
    assert.ok(entry.platformId.length > 0);
    assert.ok(entry.templateId.length > 0);
    assert.equal(entry.provenance.manifestSource, 'procedureManualManifest.json');
  }

  const flex = entries.find((e) => e.manualId === 'SAMSUNG-FLEXWASH-WASHER');
  assert.ok(flex);
  assert.equal((flex as { specialHandling?: { batchHandling: string } }).specialHandling?.batchHandling, 'architecture_exception_expected');
});

test('manual disposition model — primaryDisposition + orthogonal boolean flags', () => {
  const contract = readJson('CG_PRODUCTION_NORMALIZATION_BATCH_CONTRACT_v1.json');
  const model = contract.manualDispositionModel as {
    requiredFields: Record<string, unknown>;
    precedenceForPrimaryDisposition: string[];
  };
  const auditSchema = contract.auditManifestSchema as {
    perManualRequired: { counts: Record<string, string> };
  };

  const fields = Object.keys(model.requiredFields);
  assert.ok(fields.includes('primaryDisposition'));
  assert.ok(fields.includes('hasCanonicalMappings'));
  assert.ok(fields.includes('hasOverlayCandidates'));
  assert.ok(fields.includes('hasUnresolvedTerms'));
  assert.ok(fields.includes('hasArchitectureException'));

  for (const value of model.precedenceForPrimaryDisposition) {
    assert.ok((PRIMARY_DISPOSITION_VALUES as readonly string[]).includes(value));
  }

  assert.ok(auditSchema.perManualRequired.counts.canonicalMappings);
  assert.ok(auditSchema.perManualRequired.counts.overlayCandidateCount);
  assert.ok(auditSchema.perManualRequired.counts.promotionBlocked);
});

test('batch STOP semantics — forward halt, retain completed, pending remainder', () => {
  const contract = readJson('CG_PRODUCTION_NORMALIZATION_BATCH_CONTRACT_v1.json');
  const stop = contract.batchStopSemantics as {
    deterministicBehavior: {
      onArchitectureException: {
        forwardProgressHalted: boolean;
        priorCompletedManuals: { retained: boolean; mutatedOnStop: boolean };
        subsequentManuals: { processed: boolean; batchState: string };
      };
    };
    flexwashSpecialCase: { manualId: string; expectedBehavior: string };
  };

  const onExc = stop.deterministicBehavior.onArchitectureException;
  assert.equal(onExc.forwardProgressHalted, true);
  assert.equal(onExc.priorCompletedManuals.retained, true);
  assert.equal(onExc.priorCompletedManuals.mutatedOnStop, false);
  assert.equal(onExc.subsequentManuals.processed, false);
  assert.equal(onExc.subsequentManuals.batchState, 'pending');
  assert.ok(stop.flexwashSpecialCase.expectedBehavior.includes('architecture_exception'));
});

test('promotion rules — candidates only, no auto promotion or inference', () => {
  const contract = readJson('CG_PRODUCTION_NORMALIZATION_BATCH_CONTRACT_v1.json');
  const rules = contract.promotionRules as Record<string, boolean>;

  assert.equal(rules.candidatesOnly, true);
  assert.equal(rules.automaticCanonicalPromotion, false);
  assert.equal(rules.automaticOverlayPublication, false);
  assert.equal(rules.crossManufacturerInference, false);
  assert.equal(rules.topologyInference, false);
});

test('pilot closure preserved — batch contract does not authorize execution', () => {
  const pilotClosure = readJson('CG_PRODUCTION_NORMALIZATION_PILOT_CLOSURE_v1.json');
  const contract = readJson('CG_PRODUCTION_NORMALIZATION_BATCH_CONTRACT_v1.json');

  assert.equal(pilotClosure.verdict, 'GREEN / PILOT_GATE_CLOSED');
  assert.equal(pilotClosure.authorizesProductionBatch, false);
  assert.equal(contract.status, 'defined_not_executed');

  const exceptionPath = join(CANDIDATES, 'SAMSUNG-FLEXWASH-WASHER', 'architecture_exception.json');
  assert.ok(existsSync(exceptionPath));
});

test('frozen canonical hashes unchanged at batch contract definition', () => {
  const registry = readJson('frozen_canonical_hashes_v1.json');
  const frozen = registry.frozenOntologies as Record<string, { file: string; hash: string }>;

  for (const [, entry] of Object.entries(frozen)) {
    assert.equal(sha256File(join(REPO_ROOT, entry.file)), entry.hash);
  }
});
