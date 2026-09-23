import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const REPO_ROOT = resolve(process.cwd(), '..');
const CANONICAL = join(process.cwd(), 'components/diagnostics/knowledge/canonical');
const NORMALIZATION = join(process.cwd(), 'components/diagnostics/knowledge/normalization');

function sha256File(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(CALIBRATION, name), 'utf8'));
}

function readRepoText(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), 'utf8');
}

test('governance lock GREEN — contract, audit, frozen hash registry present', () => {
  const lock = readJson('CG_PRODUCTION_INGESTION_GOVERNANCE_LOCK_v1.json');
  const contract = readJson('CG_PRODUCTION_INGESTION_GOVERNANCE_CONTRACT_v1.json');
  const audit = readJson('CG_PRODUCTION_INGESTION_GOVERNANCE_AUDIT_v1.json');
  const hashes = readJson('frozen_canonical_hashes_v1.json');

  assert.equal(lock.verdict, 'CLOSED / PRODUCTION_INGESTION_GOVERNANCE_LOCKED');
  assert.equal(contract.workstream, 'CG-PRODUCTION-INGESTION-GOVERNANCE');
  assert.equal(audit.verdict, 'GREEN / GOVERNANCE_AUDIT_COMPLETE — GAPS_DOCUMENTED_AND_PARTIALLY_CLOSED');
  assert.equal(hashes.status, 'production_locked');
  assert.equal(
    (lock.headlineMetrics as { normalizationBatchAuthorized: boolean }).normalizationBatchAuthorized,
    false,
  );
});

test('architecture escape hatch defined — no silent canonical expansion', () => {
  const contract = readJson('CG_PRODUCTION_INGESTION_GOVERNANCE_CONTRACT_v1.json');
  const hatch = contract.architectureEscapeHatch as {
    forbiddenShortcut: string;
    requiredBehavior: string;
    decisionTree: string[];
  };

  assert.ok(hatch.forbiddenShortcut.includes('canonical/foo.json'));
  assert.ok(hatch.requiredBehavior.includes('architecture'));
  assert.ok(hatch.decisionTree.some((step) => step.includes('ARCHITECTURE_GATE')));
});

test('pipeline stages write to correct layers — not canonical ontologies', () => {
  const contract = readJson('CG_PRODUCTION_INGESTION_GOVERNANCE_CONTRACT_v1.json');
  const stages = contract.pipelineModel as { stages: Array<{ id: string; mustNotWrite?: string[] }> };

  const normalization = stages.stages.find((stage) => stage.id === 'normalization');
  const compounding = stages.stages.find((stage) => stage.id === 'compounding');
  const overlay = stages.stages.find((stage) => stage.id === 'manufacturer_overlay');

  assert.ok(normalization?.mustNotWrite?.some((rule) => rule.includes('canonical/*.json')));
  assert.ok(compounding?.mustNotWrite?.some((rule) => rule.includes('canonical/*.json')));
  assert.ok(overlay?.mustNotWrite?.some((rule) => rule.includes('{ontologyId}.json')));
});

test('frozen_canonical_hashes_v1.json matches on-disk canonical files', () => {
  const registry = readJson('frozen_canonical_hashes_v1.json');
  const frozen = registry.frozenOntologies as Record<string, { file: string; hash: string }>;

  for (const [ontologyId, entry] of Object.entries(frozen)) {
    const absolutePath = join(REPO_ROOT, entry.file.replace(/\//g, '\\').replace(/\\/g, '/'));
    const normalizedPath = join(REPO_ROOT, entry.file);
    const path = existsSync(normalizedPath) ? normalizedPath : absolutePath;
    assert.equal(sha256File(path), entry.hash, `${ontologyId} hash must match registry`);
  }
});

test('normalization pipeline writes candidates only — code path guard', () => {
  const pipelineSource = readRepoText('backend/scripts/normalization/pipeline.py');
  assert.ok(pipelineSource.includes('CANDIDATES_DIR'));
  assert.ok(pipelineSource.includes('canonical_mapping_candidates.json'));
  assert.equal(pipelineSource.includes('CANONICAL_DIR'), false);
  assert.equal(pipelineSource.includes('knowledge/canonical'), false);
});

test('promotion publish writes overlays only — not canonical ontologies', () => {
  const publishSource = readRepoText('backend/scripts/normalization/promotion/publish.py');
  assert.ok(publishSource.includes('MANUFACTURER_OVERLAYS_DIR'));
  assert.equal(publishSource.includes('knowledge/canonical/range_oven.json'), false);
  assert.ok(publishSource.includes('validate_canonical_graph'));
});

test('CG-5.3 and hierarchy contract referenced in governance artifacts', () => {
  const contract = readJson('CG_PRODUCTION_INGESTION_GOVERNANCE_CONTRACT_v1.json');
  const rules = contract.immutableRules as Array<{ id: string }>;
  assert.ok(rules.some((rule) => rule.id === 'no_canonical_from_single_manual'));
  assert.ok(existsSync(join(CALIBRATION, 'knowledge_hierarchy_contract_v1.json')));
});

test('architecture complete + governance both block normalization batch', () => {
  const archClosure = readJson('CG_CANONICAL_ARCHITECTURE_COMPLETE_CLOSURE_v1.json');
  const govLock = readJson('CG_PRODUCTION_INGESTION_GOVERNANCE_LOCK_v1.json');

  assert.equal(
    (archClosure.governanceConclusion as { normalizationAuthorized: boolean }).normalizationAuthorized,
    false,
  );
  assert.equal(
    (govLock.headlineMetrics as { normalizationBatchAuthorized: boolean }).normalizationBatchAuthorized,
    false,
  );
  assert.equal(govLock.authorizedNextWorkstream, 'CG-PRODUCTION-NORMALIZATION-PILOT');
});

test('product-configuration canonical graphs still absent', () => {
  for (const graph of ['cooktop.json', 'wall_oven.json', 'standalone_freezer.json', 'stacked_laundry_center.json']) {
    assert.equal(existsSync(join(CANONICAL, graph)), false, `${graph} must not exist`);
  }
});

test('audit documents key enforcement gaps and remediations', () => {
  const audit = readJson('CG_PRODUCTION_INGESTION_GOVERNANCE_AUDIT_v1.json');
  const findings = audit.findings as Array<{ id: string; verdict: string }>;

  assert.ok(findings.some((finding) => finding.id === 'A4'));
  assert.ok(findings.some((finding) => finding.id === 'A10' && finding.verdict === 'gap_closed_by_this_workstream'));
  assert.ok(findings.some((finding) => finding.id === 'A11'));
});
