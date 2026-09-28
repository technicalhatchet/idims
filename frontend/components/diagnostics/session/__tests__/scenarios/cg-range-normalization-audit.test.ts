import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { FROZEN_ELECTRIC_RANGE_REV1_HASH } from '../../../knowledge/canonical/canonicalRegistry';
import rangeOvenOntology from '../../../knowledge/canonical/range_oven.json';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANONICAL = join(process.cwd(), 'components/diagnostics/knowledge/canonical');

const NORMALIZATION_ARTIFACTS = [
  'CG_RANGE_NX60_NORMALIZATION_v1.json',
  'CG_RANGE_NE58R9560WS_NORMALIZATION_v1.json',
  'CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json',
  'CG_RANGE_W11174814_NORMALIZATION_v1.json',
];

const PINNED_HISTORICAL_HASHES: Record<string, string> = {
  'CG10_ELECTRIC_RANGE_FREEZE_LOCK_v1.json':
    '47fbc627c0f106a508e6b92c7146c3379fa3e589dbb54e15b4a0b5941ed8fe02',
  'CG11_GAS_RANGE_FIT_CLOSURE_v1.json':
    '620389cb8bc700f3bc28eca411f38a499e8658a97e66ae2a2fc4575bc6ffb8aa',
  'CG12_INDUCTION_FIT_CLOSURE_v1.json':
    'd3e2f4d1290939c93c7b645c6e99ba664e881e69f9f38ad954e00bc1771348e4',
  'CG13_DUAL_FUEL_FIT_CLOSURE_v1.json':
    'fd03e4fc6ca64f3041bd15525c3420a3fb95f59edd44a8f60f582eb147a63a20',
  'CG_RANGE_FAMILY_REVIEW_CLOSURE_v1.json':
    'd139e62b4c251e26760b4b177e940e235b94976356980abe4a3e7a2a71f08d3a',
  'SAMSUNG_NX60_RANGE_gr_cg11x_observation_v1.json':
    'b2d24ab6bb1536d841e0cc9d3c85ce66ae5eca6f2e830b25f7139ac3c96754b2',
  'SAMSUNG_NE58R9560WS_IR_CG12X_OBSERVATION_v1.json':
    'b9e1aa6cc413a6867461bc5ea2dd7d8e8ca92b6decdbb0411ccfccc2668e418a',
  'SAMSUNG_NY63T8751SS_DF_CG13X_OBSERVATION_v1.json':
    'f5cf17e2a0ba6be0e5ad1b59d8efe69a534afc020dc9fdcef3c336256197ccc1',
};

const RANGE_OVEN_HASH_AT_AUDIT =
  'e29bb5fafe2afacdba3b45a1ec8e4ec0b73c78d51ff6319bb6a7c0e20a7b4fc5';

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('CG_RANGE_NORMALIZATION_AUDIT is GREEN with 4/4 artifacts and 32/32 regression', () => {
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NORMALIZATION_AUDIT_v1.json'), 'utf8'),
  );
  const parent = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NORMALIZATION_v1.json'), 'utf8'),
  );

  assert.equal(audit.status, 'closed');
  assert.equal(audit.verdict, 'GREEN / NORMALIZATION_AUDIT_PASSED');
  assert.equal(audit.summary.targetsNormalized, '4/4');
  assert.equal(audit.summary.perTargetProvenanceAuditsGreen, '4/4');
  assert.equal(audit.summary.normalizationRegressionTests, '32/32 green');
  assert.equal(audit.summary.canonicalOntologyId, 'range_oven');
  assert.equal(audit.summary.cg10Through13HistoricalMutations, 0);

  assert.equal(parent.status, 'closed');
  assert.equal(parent.exitCriteria.provenanceAuditGreen, true);
  assert.equal(parent.exitCriteria.normalizationRegressionGreen, true);
  assert.equal(parent.exitCriteria.closureArtifact, 'CG_RANGE_NORMALIZATION_AUDIT_v1.json');
  assert.equal(parent.compoundingBlockedUntil, null);
  assert.equal(parent.compoundingWorkstream, 'CG_RANGE_COMPOUNDING_v1.json');
});

test('all four normalization artifacts present with green per-target provenance audits', () => {
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NORMALIZATION_AUDIT_v1.json'), 'utf8'),
  );

  assert.equal(audit.normalizationArtifacts.allPresent, true);
  assert.equal(audit.normalizationArtifacts.presentCount, 4);

  for (const artifact of NORMALIZATION_ARTIFACTS) {
    assert.ok(existsSync(join(CALIBRATION, artifact)), `missing ${artifact}`);
    const target = JSON.parse(readFileSync(join(CALIBRATION, artifact), 'utf8'));
    assert.equal(target.status, 'normalized');
    assert.equal(target.canonicalOntologyId, 'range_oven');
    assert.equal(target.provenanceAudit.status, 'passed');
    assert.ok(target.excludedFromCanonicalPromotion?.length > 0);
  }

  const w111 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_W11174814_NORMALIZATION_v1.json'), 'utf8'),
  );
  assert.equal(w111.role, 'corroboration');
  assert.equal(w111.notRetroactiveFitEvidence, true);
  assert.equal(w111.evidenceLineageGuardrail.fitEvidenceReference, null);
  assert.equal(w111.corroborationFindings.noCanonicalExpansionRequired, true);
});

test('canonical integrity — electric_range frozen, range_oven CG-10 lineage, no fuel-specific graphs', () => {
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NORMALIZATION_AUDIT_v1.json'), 'utf8'),
  );

  const electricHash = sha256File(join(CANONICAL, 'electric_range.json'));
  assert.equal(electricHash, FROZEN_ELECTRIC_RANGE_REV1_HASH);
  assert.equal(electricHash, audit.canonicalIntegrity['electric_range.json'].hash);

  const rangeOvenHash = sha256File(join(CANONICAL, 'range_oven.json'));
  assert.equal(rangeOvenHash, RANGE_OVEN_HASH_AT_AUDIT);
  assert.equal(
    rangeOvenOntology.ontology.organizationalLineage?.adoptedHash,
    FROZEN_ELECTRIC_RANGE_REV1_HASH,
  );
  assert.equal(audit.canonicalIntegrity['range_oven.json'].cg10LineageConsistent, true);
  assert.equal(audit.canonicalIntegrity.fuelSpecificCanonicalGraphsCreated, false);

  for (const filename of audit.canonicalIntegrity.absentCanonicalFiles) {
    assert.equal(existsSync(join(CANONICAL, filename)), false);
  }
});

test('zero CG-10–13 historical artifact mutations — pinned hashes match', () => {
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NORMALIZATION_AUDIT_v1.json'), 'utf8'),
  );

  assert.equal(audit.historicalArtifactIntegrity.cg10Through13Mutations, 0);
  assert.equal(audit.historicalArtifactIntegrity.allHashesMatch, true);

  for (const [filename, expectedHash] of Object.entries(PINNED_HISTORICAL_HASHES)) {
    const actual = sha256File(join(CALIBRATION, filename));
    assert.equal(actual, expectedHash, `hash mismatch for ${filename}`);
    assert.equal(audit.historicalArtifactIntegrity.pinnedHashes[filename], expectedHash);
  }
});

test('ontology boundary checks — no promotion, no smuggled expansion, W11174814 corroboration', () => {
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NORMALIZATION_AUDIT_v1.json'), 'utf8'),
  );

  assert.equal(audit.corroborationPolicy.w11174814Role, 'corroboration');
  assert.equal(audit.corroborationPolicy.notRetroactiveFitEvidence, true);
  assert.equal(audit.corroborationPolicy.fitEvidenceReference, null);
  assert.equal(audit.ontologyBoundaryChecks.noImplementationVocabularyPromotedToCanonical, true);
  assert.equal(audit.ontologyBoundaryChecks.noCanonicalExpansionSmuggledThroughNormalization, true);

  const greenChecks = audit.auditChecks.filter((check: { status: string }) => check.status === 'green');
  assert.equal(greenChecks.length, audit.auditChecks.length);
});

test('CG-RANGE-NORMALIZATION audit unlocks CG-RANGE-COMPOUNDING in workstream sequence', () => {
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NORMALIZATION_AUDIT_v1.json'), 'utf8'),
  );
  const sequence = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_WORKSTREAM_SEQUENCE_v1.json'), 'utf8'),
  );
  const compounding = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_COMPOUNDING_v1.json'), 'utf8'),
  );

  assert.equal(audit.unlocks.compounding, 'CG-RANGE-COMPOUNDING');
  assert.equal(audit.unlocks.compoundingArtifact, 'CG_RANGE_COMPOUNDING_v1.json');

  assert.equal(sequence.disciplinedSequence[5].status, 'closed');
  assert.equal(sequence.disciplinedSequence[5].closureArtifact, 'CG_RANGE_NORMALIZATION_AUDIT_v1.json');
  assert.equal(sequence.disciplinedSequence[6].status, 'active');
  assert.equal(sequence.disciplinedSequence[6].gateArtifact, 'CG_RANGE_COMPOUNDING_v1.json');

  assert.equal(compounding.status, 'active');
  assert.equal(compounding.priorPhaseClosed, 'CG_RANGE_NORMALIZATION_AUDIT_v1.json');
  assert.equal(compounding.normalizedEvidenceInputs.length, 4);
  assert.ok(
    compounding.immutableRules.some((rule: string) =>
      rule.includes('redesign the ontology'),
    ),
  );
});
