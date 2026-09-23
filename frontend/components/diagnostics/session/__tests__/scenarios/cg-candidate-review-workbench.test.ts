import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const REPO_ROOT = resolve(process.cwd(), '..');
const REVIEW_DIR = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/review',
);
const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANDIDATES_DIR = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/candidates',
);
const CANONICAL = join(process.cwd(), 'components/diagnostics/knowledge/canonical');

const INDEX_FILE = 'CG_PRODUCTION_NORMALIZATION_CANDIDATE_REVIEW_INDEX_v1.json';
const DECISIONS_FILE = 'CG_PRODUCTION_NORMALIZATION_CANDIDATE_REVIEW_DECISIONS_v1.json';
const BATCH_RUN_ID = 'batch-20260918-5d213986';
const PROCESSING_MANIFEST_HASH =
  '0d537288a76ed9b2bdc3fd7fec8ccb9e5187bf282dc68b917790a1fd184a4013';

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function countUnresolvedOnDisk(): number {
  let total = 0;
  for (const manualId of readdirSync(CANDIDATES_DIR)) {
    if (manualId.startsWith('_')) continue;
    const mappingPath = join(CANDIDATES_DIR, manualId, 'canonical_mapping_candidates.json');
    if (!existsSync(mappingPath)) continue;
    const candidates = (readJson(mappingPath).candidates as Array<{ status?: string }>) || [];
    total += candidates.filter((candidate) => candidate.status === 'UNRESOLVED_TERM').length;
  }
  return total;
}

test('review index artifact exists and encodes batch identity', () => {
  const indexPath = join(REVIEW_DIR, INDEX_FILE);
  assert.ok(existsSync(indexPath), 'candidate review index must be generated');
  const index = readJson(indexPath);
  assert.equal(index.batchRunId, BATCH_RUN_ID);
  assert.equal(index.processingManifestHash, PROCESSING_MANIFEST_HASH);
  assert.equal(index.promotionExplicitlyExcluded, true);
  assert.ok((index.totalCandidateRecords as number) > 0);
});

test('review index exposes all candidate classes requiring visibility', () => {
  const index = readJson(join(REVIEW_DIR, INDEX_FILE));
  const records = index.candidateRecords as Array<Record<string, unknown>>;
  const classes = new Set(records.map((record) => record.reviewClass));
  const sources = new Set(records.map((record) => record.artifactSource));

  assert.ok(classes.has('unresolved'));
  assert.ok(classes.has('implementationSpecific'));
  assert.ok(classes.has('newPlatformKnowledge'));
  assert.ok(classes.has('existingCanonicalMapping'));
  assert.equal((index.countsByReviewClass as Record<string, number>).newCanonicalKnowledge, 0);
  assert.ok(classes.has('architectureException'));
  assert.ok(sources.has('canonical_mapping'));
  assert.ok(sources.has('overlay'));
  assert.ok(sources.has('architecture_exception'));
});

test('no unresolved candidate disappears from the index', () => {
  const index = readJson(join(REVIEW_DIR, INDEX_FILE));
  const records = index.candidateRecords as Array<Record<string, unknown>>;
  const indexedUnresolved = records.filter(
    (record) =>
      record.reviewClass === 'unresolved'
      || record.candidateStatus === 'UNRESOLVED_TERM',
  ).length;
  const onDiskUnresolved = countUnresolvedOnDisk();
  assert.ok(indexedUnresolved >= onDiskUnresolved);
});

test('review status defaults to unreviewed in index', () => {
  const index = readJson(join(REVIEW_DIR, INDEX_FILE));
  const records = index.candidateRecords as Array<{ reviewStatus?: string }>;
  assert.ok(records.every((record) => record.reviewStatus === 'unreviewed'));
});

test('RS22T reconciliation preserves historical observation and current artifacts', () => {
  const index = readJson(join(REVIEW_DIR, INDEX_FILE));
  const reconciliations = index.manualReconciliations as Array<Record<string, unknown>>;
  const rs22t = reconciliations.find((entry) => entry.manualId === 'SAMSUNG-RS22T-SXS');
  assert.ok(rs22t);
  const historical = (rs22t.historicalObservation as { counts: { candidateCount: number } }).counts;
  const current = rs22t.currentOnDiskCandidateState as { mappingCandidateCount: number; procedureCount: number };
  assert.equal(historical.candidateCount, 0);
  assert.equal(current.mappingCandidateCount, 33);
  assert.equal(current.procedureCount, 17);
  assert.equal(rs22t.useForReview, 'currentCandidateArtifacts');
});

test('FlexWash exposes historical STOP and current cleared-stop resume state', () => {
  const index = readJson(join(REVIEW_DIR, INDEX_FILE));
  const reconciliations = index.manualReconciliations as Array<Record<string, unknown>>;
  const flexwash = reconciliations.find((entry) => entry.manualId === 'SAMSUNG-FLEXWASH-WASHER');
  assert.ok(flexwash);
  const historical = flexwash.historicalObservation as { batchState: string };
  const currentResume = flexwash.currentResume as {
    batchState: string;
    reNormalize: boolean;
  };
  assert.equal(historical.batchState, 'stopped_trigger');
  assert.equal(currentResume.batchState, 'cleared_stop');
  assert.equal(currentResume.reNormalize, false);
});

test('index ordering is deterministic across rebuild', () => {
  execFileSync('python', [join(REPO_ROOT, 'backend/scripts/generate_candidate_review_index.py')], {
    cwd: REPO_ROOT,
    stdio: 'pipe',
  });
  const first = (readJson(join(REVIEW_DIR, INDEX_FILE)).candidateRecords as Array<{ candidateId: string }>)
    .map((record) => record.candidateId);
  execFileSync('python', [join(REPO_ROOT, 'backend/scripts/generate_candidate_review_index.py')], {
    cwd: REPO_ROOT,
    stdio: 'pipe',
  });
  const second = (readJson(join(REVIEW_DIR, INDEX_FILE)).candidateRecords as Array<{ candidateId: string }>)
    .map((record) => record.candidateId);
  assert.deepEqual(first, second);
});

test('historical manual queue artifact is not rewritten by review tooling', () => {
  const queuePath = join(REVIEW_DIR, 'batch_human_review_queue.json');
  const before = sha256File(queuePath);
  execFileSync('python', [join(REPO_ROOT, 'backend/scripts/generate_candidate_review_index.py')], {
    cwd: REPO_ROOT,
    stdio: 'pipe',
  });
  const after = sha256File(queuePath);
  assert.equal(before, after);
});

test('decisions artifact is separate from promotion ledger', () => {
  const decisionsPath = join(REVIEW_DIR, DECISIONS_FILE);
  const ledgerPath = join(REVIEW_DIR, 'ledger.json');
  assert.ok(existsSync(decisionsPath));
  assert.ok(existsSync(ledgerPath));
  const decisions = readJson(decisionsPath);
  assert.equal(decisions.reportType, 'candidate_review_decisions');
});

test('frozen canonical hashes unchanged after index generation', () => {
  const registry = readJson(join(CALIBRATION, 'frozen_canonical_hashes_v1.json'));
  const frozen = registry.frozenOntologies as Record<string, { file: string; hash: string }>;
  for (const [ontologyId, entry] of Object.entries(frozen)) {
    const graphPath = resolve(process.cwd(), '..', entry.file.replace(/^frontend\//, 'frontend/'));
    const normalizedPath = join(CANONICAL, `${ontologyId}.json`);
    const path = existsSync(graphPath) ? graphPath : normalizedPath;
    assert.equal(sha256File(path), entry.hash, `${ontologyId} hash must match registry`);
  }
});

test('newCanonicalKnowledge must not equal successful canonical mapping pool', () => {
  const index = JSON.parse(readFileSync(join(REVIEW_DIR, INDEX_FILE), 'utf8')) as Record<string, unknown>;
  const counts = index.countsByReviewClass as Record<string, number>;
  let successfulMappings = 0;
  for (const manualId of readdirSync(CANDIDATES_DIR)) {
    if (manualId.startsWith('_')) continue;
    const mappingPath = join(CANDIDATES_DIR, manualId, 'canonical_mapping_candidates.json');
    if (!existsSync(mappingPath)) continue;
    const candidates = (readJson(mappingPath).candidates as Array<{ status?: string; canonicalId?: string }>) || [];
    successfulMappings += candidates.filter(
      (candidate) => candidate.status === 'candidate' && candidate.canonicalId,
    ).length;
  }
  assert.equal(counts.existingCanonicalMapping, successfulMappings);
  assert.notEqual(counts.newCanonicalKnowledge, successfulMappings);
  assert.equal(counts.newCanonicalKnowledge, 0);
});

test('review workbench UI and API files exist with no promotion path', () => {
  const ui = join(process.cwd(), 'pages/solomon/knowledge/review.js');
  const api = join(process.cwd(), 'pages/api/knowledge/normalization/review/decisions.js');
  const workbench = join(process.cwd(), 'components/solomon/knowledge/CandidateReviewWorkbench.js');
  assert.ok(existsSync(ui));
  assert.ok(existsSync(api));
  assert.ok(existsSync(workbench));
  const apiSource = readFileSync(api, 'utf8');
  assert.ok(!apiSource.includes('plan_promotion'));
  assert.ok(!apiSource.includes('apply_promotion'));
  assert.ok(apiSource.includes('promotionExcluded'));
  assert.match(apiSource, /req\.method === 'GET'/);
  assert.match(apiSource, /Staff access required/);
  assert.match(apiSource, /ALLOWED_STATUSES/);
  assert.ok(!apiSource.includes('ledger'));
});

test('workbench renders expandable What / Where / Why review questions', () => {
  const detailPanel = readFileSync(
    join(process.cwd(), 'components/solomon/knowledge/CandidateReviewDetailPanel.js'),
    'utf8',
  );
  assert.match(detailPanel, /CollapsibleSection/);
  assert.match(detailPanel, /REVIEW_SECTION_NUMBERED_LABELS/);
  assert.match(detailPanel, /REVIEW_SECTION_NUMBERED_LABELS\.mapsTo/);
  assert.match(detailPanel, /REVIEW_SECTION_NUMBERED_LABELS\.where/);
  assert.match(detailPanel, /REVIEW_SECTION_NUMBERED_LABELS\.where/);
  assert.match(detailPanel, /whereSectionPreview/);
  assert.match(detailPanel, /REVIEW_SECTION_NUMBERED_LABELS\.why/);
  assert.match(detailPanel, /formatWhereProvenance/);
  assert.match(detailPanel, /openSections/);
  assert.match(detailPanel, /SectionPreviewBlock/);
  assert.match(detailPanel, /aria-expanded/);
  assert.match(detailPanel, /solomon-focus-ring/);
  assert.match(detailPanel, /SOLOMON_REFERENCE_EYEBROW_CLASS/);
});
