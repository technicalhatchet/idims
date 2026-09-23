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
import samsungTopLoadWasherOverlay from '../../../knowledge/canonical/manufacturer_overlays/samsung_top_load_washer.json';
import whirlpoolTopLoadWasherOverlay from '../../../knowledge/canonical/manufacturer_overlays/whirlpool_top_load_washer.json';
import topLoadWasherOntology from '../../../knowledge/canonical/top_load_washer.json';

const EXPECTED_CANONICAL_HASH =
  'dee6b0c7128706eb78ac0e290090cd3d79d98dad579f41d6fa0a36ea3fdbf2b5';

function sha256File(relativeFromFrontend: string): string {
  const path = resolve(process.cwd(), relativeFromFrontend);
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function runCg67SamsungTlA50PromotionDryRun(): void {
  const canonicalHash = sha256File('components/diagnostics/knowledge/canonical/top_load_washer.json');
  assert.equal(canonicalHash, EXPECTED_CANONICAL_HASH);

  assert.ok(
    samsungTopLoadWasherOverlay.status === 'published' ||
      samsungTopLoadWasherOverlay.status === 'draft',
  );
  assert.equal(samsungTopLoadWasherOverlay.gateKind, 'samsung_tl_first_manual_compounding');
  assert.equal(samsungTopLoadWasherOverlay.compoundingEvidence?.isLearningEvent, true);
  assert.equal(samsungTopLoadWasherOverlay.compoundingEvidence?.isCertification, false);
  assert.notEqual(samsungTopLoadWasherOverlay.compoundingEvidence?.isCertification, true);

  if (samsungTopLoadWasherOverlay.status === 'published') {
    const learningIds = new Set(
      (samsungTopLoadWasherOverlay.compoundingEvidence?.learningDecisions ?? []).map(
        (d) => d.artifactId,
      ),
    );
    assert.deepEqual(
      learningIds,
      new Set([
        'seed:clutch',
        'seed:door_lock',
        'seed:main_control',
        'seed:supply',
        'seed:user_interface',
        'seed:wash_ntc',
      ]),
    );
    for (const record of samsungTopLoadWasherOverlay.compoundingEvidence?.learningDecisions ?? []) {
      assert.equal(record.isLearningEvent, true);
      assert.equal(record.isCertification, false);
    }
  }

  assert.equal(resolveCanonicalOntologyId('washer', 'samsung_tl_washer_a50'), 'top_load_washer');

  const componentIds = topLoadWasherOntology.components.map((c) => c.id);
  assert.ok(!componentIds.includes('drive_system'));

  const family = samsungTopLoadWasherOverlay.platformFamilies[0];
  assert.equal(family.platformId, 'samsung_tl_washer_a50');
  assert.equal(family.oemTermAliases.door_lock, 'lid_lock');
  assert.notEqual(family.oemTermAliases.door_lock, 'lid_switch');
  assert.ok(!Object.values(family.oemTermAliases).includes('lid_switch'));
  assert.equal(family.oemTermAliases.supply, 'power_supply');
  assert.equal(family.oemTermAliases.wash_ntc, 'temperature_sensor');
  assert.equal(family.oemTermAliases.main_control, 'control_board');
  assert.equal(family.oemTermAliases.user_interface, 'hmi_control');
  assert.equal(family.oemTermAliases.wash_heater, undefined);

  const platformIds = new Set((family.add?.components ?? []).map((c) => c.id));
  assert.ok(platformIds.has('clutch'));
  assert.ok(platformIds.has('supply'));
  assert.ok(platformIds.has('wash_ntc'));
  assert.ok(!platformIds.has('wash_heater'));
  assert.ok(!platformIds.has('drive_system'));

  const boundProcedures = new Set(
    (family.procedureBindings ?? []).map((b) => b.procedureId),
  );
  assert.ok(boundProcedures.has('samsungtla50-door-lock'));
  assert.ok(boundProcedures.has('samsungtla50-power-supply'));
  assert.ok(!boundProcedures.has('samsungtla50-clutch'));
  assert.ok(!boundProcedures.has('samsungtla50-wash-heater'));
  assert.equal(
    family.procedureBindings?.find((b) => b.procedureId === 'samsungtla50-door-lock')?.testTargetId,
    'lid_lock_test',
  );

  const roleEvidence = samsungTopLoadWasherOverlay.certificationEvidence?.procedureRoleEvidence ?? [];
  assert.equal(roleEvidence.length, 2);
  const lidSwitchRole = roleEvidence.find((r) => r.roleId === 'lid_switch_authorization');
  const lidLockRole = roleEvidence.find((r) => r.roleId === 'lid_lock_spin_safety');
  assert.ok(lidSwitchRole);
  assert.ok(lidLockRole);
  assert.deepEqual(lidSwitchRole?.canonicalComponents, ['lid_switch']);
  assert.deepEqual(lidLockRole?.canonicalComponents, ['lid_lock']);

  const samsungResolved = resolveDiagnosticGraph({
    templateId: 'washer',
    manufacturer: 'Samsung',
    model: 'WA50R5200',
    platformId: 'samsung_tl_washer_a50',
  });
  assert.ok(samsungResolved);
  assert.equal(samsungResolved.resolution.canonicalOntologyId, 'top_load_washer');
  assert.equal(samsungResolved.resolution.platformFamilyId, 'samsung_tl_washer_a50');
  assert.ok(
    samsungResolved.procedureBindings.some(
      (b) => b.procedureId === 'samsungtla50-door-lock' && b.testTargetId === 'lid_lock_test',
    ),
  );

  const whirlpoolFamilyOnSamsung = selectPlatformFamilyOverlay(whirlpoolTopLoadWasherOverlay as never, {
    templateId: 'washer',
    manufacturer: 'Samsung',
    model: 'WA50R5200',
    platformId: 'samsung_tl_washer_a50',
  });
  assert.equal(whirlpoolFamilyOnSamsung, null);

  const tlOverlays = getManufacturerOverlaysForOntology('top_load_washer');
  assert.equal(tlOverlays.length, 2);

  const tlOntology = getCanonicalOntologyForTemplate('washer', 'samsung_tl_washer_a50');
  assert.equal(tlOntology?.ontology.id, 'top_load_washer');
  const lidSwitch = tlOntology?.components.find((c) => c.id === 'lid_switch');
  assert.equal(lidSwitch?.canonicalStatus, 'conditional');
}

runCg67SamsungTlA50PromotionDryRun();
console.log('cg67-samsung-tl-a50-promotion-dry-run: PASS');
