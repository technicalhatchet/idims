import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getCanonicalOntologyForTemplate,
  resolveCanonicalOntologyId,
} from '../../../knowledge/canonical/canonicalRegistry';
import {
  getManufacturerOverlaysForOntology,
  resolveDiagnosticGraph,
  selectPlatformFamilyOverlay,
} from '../../../knowledge/canonical/resolveDiagnosticGraph';
import whirlpoolFrontLoadWasherOverlay from '../../../knowledge/canonical/manufacturer_overlays/whirlpool_front_load_washer.json';
import whirlpoolTopLoadWasherOverlay from '../../../knowledge/canonical/manufacturer_overlays/whirlpool_top_load_washer.json';
import samsungFrontLoadWasherOverlay from '../../../knowledge/canonical/manufacturer_overlays/samsung_front_load_washer.json';
import samsungTopLoadWasherOverlay from '../../../knowledge/canonical/manufacturer_overlays/samsung_top_load_washer.json';
import topLoadWasherOntology from '../../../knowledge/canonical/top_load_washer.json';

const EXPECTED_CANONICAL_HASH =
  'dee6b0c7128706eb78ac0e290090cd3d79d98dad579f41d6fa0a36ea3fdbf2b5';

const CALIBRATION_DIR = resolve(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

function sha256File(relativeFromRepoRoot: string): string {
  const path = resolve(process.cwd(), '..', relativeFromRepoRoot);
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function runCg66WhirlpoolTlCertificationClosure(): void {
  // --- Q1: Canonical integrity ---
  const canonicalHash = sha256File(
    'frontend/components/diagnostics/knowledge/canonical/top_load_washer.json',
  );
  assert.equal(canonicalHash, EXPECTED_CANONICAL_HASH);
  const ontology = topLoadWasherOntology.ontology;
  assert.equal(ontology.frozen, true);
  assert.equal(ontology.frozenRevision, 'rev1');
  const componentIds = topLoadWasherOntology.components.map((c) => c.id).sort();
  assert.equal(componentIds.length, 17);
  assert.ok(!componentIds.includes('drive_system'));
  assert.ok(componentIds.includes('transmission_or_shifter'));
  const lidSwitch = topLoadWasherOntology.components.find((c) => c.id === 'lid_switch');
  assert.equal(lidSwitch?.canonicalStatus, 'conditional');

  // --- Q2: Whirlpool TL integrity (three certified platforms) ---
  assert.equal(whirlpoolTopLoadWasherOverlay.status, 'published');
  assert.equal(
    whirlpoolTopLoadWasherOverlay.gateArtifact,
    'WHIRLPOOL_TOP_LOAD_WASHER_CG66_overlay_mapping_table_v1.json',
  );

  const w108Resolved = resolveDiagnosticGraph({
    templateId: 'washer',
    manufacturer: 'Whirlpool',
    model: 'WTW9500',
    platformId: 'whirlpool_tl_dd',
  });
  const w116Resolved = resolveDiagnosticGraph({
    templateId: 'washer',
    manufacturer: 'Whirlpool',
    model: 'WTW4950',
    platformId: 'whirlpool_tl_dd',
  });
  const w114Resolved = resolveDiagnosticGraph({
    templateId: 'washer',
    manufacturer: 'Whirlpool',
    model: 'WTW5100',
    platformId: 'whirlpool_tl_dd_5100',
  });
  assert.ok(w108Resolved);
  assert.ok(w116Resolved);
  assert.ok(w114Resolved);
  assert.equal(w108Resolved.resolution.canonicalOntologyId, 'top_load_washer');
  assert.equal(w116Resolved.resolution.canonicalOntologyId, 'top_load_washer');
  assert.equal(w114Resolved.resolution.canonicalOntologyId, 'top_load_washer');
  assert.ok(
    w108Resolved.procedureBindings.some((b) => b.procedureId?.startsWith('w10864849')),
  );
  assert.ok(
    w116Resolved.procedureBindings.some((b) => b.procedureId?.startsWith('w11697231')),
  );
  assert.ok(
    w114Resolved.procedureBindings.some((b) => b.procedureId?.startsWith('w11416787')),
  );
  assert.ok(
    !w114Resolved.procedureBindings.some((b) => b.procedureId?.startsWith('w10864849')),
  );

  const ddFamily = selectPlatformFamilyOverlay(whirlpoolTopLoadWasherOverlay as never, {
    templateId: 'washer',
    manufacturer: 'Whirlpool',
    model: 'WTW9500',
    platformId: 'whirlpool_tl_dd',
  });
  assert.ok(ddFamily);
  const overlayComponentIds = new Set(
    (ddFamily?.add?.components ?? []).map((c) => c.id),
  );
  assert.ok(overlayComponentIds.has('mode_shifter'));
  assert.ok(overlayComponentIds.has('bulk_level_switch'));
  assert.equal(ddFamily?.oemTermAliases?.['TEST #3a: Drive System — Shifter'], 'mode_shifter');

  const tlOntology = getCanonicalOntologyForTemplate('washer', 'whirlpool_tl_dd');
  assert.ok(tlOntology?.components.some((c) => c.id === 'transmission_or_shifter'));
  assert.ok(!tlOntology?.components.some((c) => c.id === 'mode_shifter'));

  // --- Q3: Authorization semantics ---
  const roleEvidence =
    whirlpoolTopLoadWasherOverlay.certificationEvidence?.procedureRoleEvidence ?? [];
  assert.ok(
    roleEvidence.some((e) => (e.canonicalComponents ?? []).includes('lid_switch')),
    'procedure-role evidence must resolve lid_switch',
  );
  for (const family of whirlpoolTopLoadWasherOverlay.platformFamilies) {
    for (const target of Object.values(family.oemTermAliases ?? {})) {
      assert.notEqual(target, 'lid_switch', 'no fabricated lid_switch matcher alias');
    }
  }
  assert.equal(w108Resolved.oemTermAliases['door_lock'], 'lid_lock');
  const lidBinding = w108Resolved.procedureBindings.find(
    (b) => b.procedureId === 'w10864849-test-08-lid-lock',
  );
  assert.equal(lidBinding?.testTargetId, 'lid_lock_test');

  // --- Q4: Cross-family isolation ---
  const flOnTl = selectPlatformFamilyOverlay(whirlpoolFrontLoadWasherOverlay as never, {
    templateId: 'washer',
    manufacturer: 'Whirlpool',
    model: 'WTW9500',
    platformId: 'whirlpool_tl_dd',
  });
  assert.equal(flOnTl, null);
  const tlOnFl = selectPlatformFamilyOverlay(whirlpoolTopLoadWasherOverlay as never, {
    templateId: 'washer',
    manufacturer: 'Whirlpool',
    model: 'WFW8300',
    platformId: 'whirlpool_duet_sport',
  });
  assert.equal(tlOnFl, null);

  const samsungTlResolved = resolveDiagnosticGraph({
    templateId: 'washer',
    manufacturer: 'Samsung',
    model: 'WA50R5200',
    platformId: 'samsung_tl_washer_a50',
  });
  assert.ok(samsungTlResolved);
  assert.equal(samsungTlResolved.resolution.canonicalOntologyId, 'top_load_washer');
  assert.ok(
    !samsungTlResolved.resolution.layers.includes('platform:whirlpool_tl_dd_direct_drive'),
    'Samsung TL must not inherit Whirlpool TL platform family',
  );
  assert.ok(
    !samsungTlResolved.procedureBindings.some((b) => b.procedureId?.startsWith('w10864849')),
  );

  const tlOverlays = getManufacturerOverlaysForOntology('top_load_washer');
  assert.equal(tlOverlays.length, 2);
  assert.deepEqual(
    new Set(tlOverlays.map((overlay) => overlay.manufacturer)),
    new Set(['Whirlpool', 'Samsung']),
  );
  assert.equal(samsungTopLoadWasherOverlay.status, 'published');
  assert.equal(samsungTopLoadWasherOverlay.compoundingEvidence?.isCertification, false);
  assert.equal(samsungTopLoadWasherOverlay.compoundingEvidence?.isLearningEvent, true);
  assert.equal(whirlpoolTopLoadWasherOverlay.gateKind, 'whirlpool_tl_corpus_rev1_certification');
  assert.ok(whirlpoolTopLoadWasherOverlay.certificationEvidence);
  assert.equal(resolveCanonicalOntologyId('washer', 'samsung_tl_washer_a50'), 'top_load_washer');
  assert.equal(resolveCanonicalOntologyId('washer', 'whirlpool_duet_sport'), 'front_load_washer');

  const tlBlob = JSON.stringify(whirlpoolTopLoadWasherOverlay).toLowerCase();
  assert.ok(!tlBlob.includes('w8178558'));
  assert.ok(!tlBlob.includes('samsungtla50'));
  assert.ok(!tlBlob.includes('samsungtlcg71'));

  const flBlob = JSON.stringify(whirlpoolFrontLoadWasherOverlay).toLowerCase();
  const samsungFlBlob = JSON.stringify(samsungFrontLoadWasherOverlay).toLowerCase();
  assert.ok(!flBlob.includes('w10864849'));
  assert.ok(!samsungFlBlob.includes('mode_shifter'));

  // --- Q5: Evidence-lock integrity ---
  const evidence = JSON.parse(
    readFileSync(
      resolve(CALIBRATION_DIR, 'WHIRLPOOL_TOP_LOAD_WASHER_CG66_CERTIFICATION_EVIDENCE_v1.json'),
      'utf8',
    ),
  );
  assert.equal(evidence.status, 'locked');
  assert.equal(evidence.verdict, 'CERTIFIED');
  assert.equal(evidence.hashes.canonical, EXPECTED_CANONICAL_HASH);
  assert.equal(
    whirlpoolTopLoadWasherOverlay.certificationPromotionId,
    evidence.publication.promotionId,
  );
  assert.equal(evidence.counts.certifiedArtifactsRepresented, 85);
  assert.equal(evidence.counts.newSemanticDecisions, 0);
  assert.equal(evidence.cg66TeachingCost, 0);
  assert.equal(evidence.historicalCompounding.manuals.length, 3);
}

runCg66WhirlpoolTlCertificationClosure();
console.log('cg66-whirlpool-tl-certification-closure: OK');
