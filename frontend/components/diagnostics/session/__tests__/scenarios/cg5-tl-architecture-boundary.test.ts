import assert from 'node:assert/strict';
import {
  getCanonicalOntologyForTemplate,
  resolveCanonicalOntologyId,
} from '../../../knowledge/canonical/canonicalRegistry';
import {
  getManufacturerOverlaysForOntology,
  platformFamilyApplies,
  resolveDiagnosticGraph,
  selectPlatformFamilyOverlay,
} from '../../../knowledge/canonical/resolveDiagnosticGraph';
import samsungTopLoadWasherOverlay from '../../../knowledge/canonical/manufacturer_overlays/samsung_top_load_washer.json';
import whirlpoolFrontLoadWasherOverlay from '../../../knowledge/canonical/manufacturer_overlays/whirlpool_front_load_washer.json';
import whirlpoolTopLoadWasherOverlay from '../../../knowledge/canonical/manufacturer_overlays/whirlpool_top_load_washer.json';

function runCg5TlArchitectureBoundary(): void {
  assert.equal(resolveCanonicalOntologyId('washer', 'whirlpool_tl_dd'), 'top_load_washer');
  assert.equal(resolveCanonicalOntologyId('washer', 'whirlpool_duet_sport'), 'front_load_washer');

  const tlOntology = getCanonicalOntologyForTemplate('washer', 'whirlpool_tl_dd');
  const flOntology = getCanonicalOntologyForTemplate('washer', 'whirlpool_duet_sport');
  assert.ok(tlOntology);
  assert.ok(flOntology);
  assert.equal(tlOntology?.ontology.id, 'top_load_washer');
  assert.equal(flOntology?.ontology.id, 'front_load_washer');
  assert.notEqual(tlOntology?.ontology.id, flOntology?.ontology.id);

  const tlResolved = resolveDiagnosticGraph({
    templateId: 'washer',
    manufacturer: 'Whirlpool',
    model: 'WTW9500',
    platformId: 'whirlpool_tl_dd',
  });
  assert.ok(tlResolved);
  assert.equal(tlResolved.resolution.canonicalOntologyId, 'top_load_washer');
  assert.ok(tlResolved.resolution.layers.includes('manufacturer:Whirlpool'));
  assert.ok(tlResolved.resolution.layers.includes('platform:whirlpool_tl_dd_direct_drive'));

  const flFamilyOnTl = selectPlatformFamilyOverlay(whirlpoolFrontLoadWasherOverlay as never, {
    templateId: 'washer',
    manufacturer: 'Whirlpool',
    model: 'WTW9500',
    platformId: 'whirlpool_tl_dd',
  });
  assert.equal(flFamilyOnTl, null, 'FL overlay family must not apply to whirlpool_tl_dd');

  for (const family of whirlpoolFrontLoadWasherOverlay.platformFamilies) {
    assert.equal(
      platformFamilyApplies(family as never, {
        templateId: 'washer',
        manufacturer: 'Whirlpool',
        model: 'WTW9500',
        platformId: 'whirlpool_tl_dd',
      }),
      false,
      `FL family ${family.platformFamilyId} must not apply to TL platform`,
    );
  }

  const tlFamily = selectPlatformFamilyOverlay(whirlpoolTopLoadWasherOverlay as never, {
    templateId: 'washer',
    manufacturer: 'Whirlpool',
    model: 'WTW9500',
    platformId: 'whirlpool_tl_dd',
  });
  assert.ok(tlFamily);
  assert.equal(tlFamily?.platformFamilyId, 'whirlpool_tl_dd_direct_drive');

  const flOverlays = getManufacturerOverlaysForOntology('front_load_washer');
  const tlOverlays = getManufacturerOverlaysForOntology('top_load_washer');
  assert.ok(flOverlays.length >= 2, 'FL ontology registers Whirlpool and Samsung manufacturer overlays');
  assert.equal(tlOverlays.length, 2, 'TL ontology registers Whirlpool and Samsung manufacturer overlays');
  assert.notEqual(flOverlays[0].canonicalOntologyId, tlOverlays[0].canonicalOntologyId);
  assert.deepEqual(
    new Set(tlOverlays.map((overlay) => overlay.manufacturer)),
    new Set(['Whirlpool', 'Samsung']),
  );
  assert.equal(samsungTopLoadWasherOverlay.status, 'published');
  assert.equal(samsungTopLoadWasherOverlay.compoundingEvidence?.isLearningEvent, true);
  assert.equal(samsungTopLoadWasherOverlay.compoundingEvidence?.isCertification, false);

  assert.ok(
    !tlResolved.procedureBindings.some((binding) => binding.procedureId?.startsWith('w8178558')),
    'TL graph must not include FL Duet Sport procedure bindings',
  );
  assert.ok(
    !tlResolved.procedureBindings.some((binding) => binding.procedureId?.startsWith('w11169652')),
    'TL graph must not include FL DD procedure bindings',
  );
  assert.ok(
    tlResolved.procedureBindings.some((binding) => binding.procedureId?.startsWith('w10864849')),
    'TL graph should include W10864849 procedure bindings',
  );

  assert.equal(tlResolved.oemTermAliases['TEST #6: Water Level'], 'pressure_sensor');
  assert.equal(tlResolved.oemTermAliases['TEST #8: Lid Lock'], 'lid_lock');
  assert.equal(tlResolved.oemTermAliases['door_lock'], 'lid_lock');

  const lidBinding = tlResolved.procedureBindings.find(
    (binding) => binding.procedureId === 'w10864849-test-08-lid-lock',
  );
  assert.equal(lidBinding?.testTargetId, 'lid_lock_test', 'TL lid lock uses lid_lock_test, not door_lock_test');

  const flResolved = resolveDiagnosticGraph({
    templateId: 'washer',
    manufacturer: 'Whirlpool',
    model: 'WFW8300',
    platformId: 'whirlpool_duet_sport',
  });
  assert.ok(flResolved);
  assert.equal(flResolved.resolution.canonicalOntologyId, 'front_load_washer');
  assert.ok(
    !flResolved.resolution.layers.includes('platform:whirlpool_tl_dd_direct_drive'),
    'FL graph must not load TL platform family',
  );

  const tl5100Resolved = resolveDiagnosticGraph({
    templateId: 'washer',
    manufacturer: 'Whirlpool',
    model: 'WTW5100',
    platformId: 'whirlpool_tl_dd_5100',
  });
  assert.ok(tl5100Resolved);
  assert.equal(tl5100Resolved.resolution.canonicalOntologyId, 'top_load_washer');
  assert.ok(
    tl5100Resolved.resolution.layers.includes('platform:whirlpool_tl_dd_5100_direct_drive'),
    'WTW5100 must resolve whirlpool_tl_dd_5100_direct_drive family',
  );
  assert.equal(tl5100Resolved.oemTermAliases['TEST #6: Water Level'], 'pressure_sensor');
  assert.equal(tl5100Resolved.oemTermAliases['TEST #8: Lid Lock'], 'lid_lock');
  assert.equal(tl5100Resolved.oemTermAliases['TEST #4: HMI'], 'hmi_control');
  assert.equal(tl5100Resolved.oemTermAliases['TEST #9: Load & Go Detergent'], 'bulk_level_switch');

  const tl5100Family = selectPlatformFamilyOverlay(whirlpoolTopLoadWasherOverlay as never, {
    templateId: 'washer',
    manufacturer: 'Whirlpool',
    model: 'WTW5100',
    platformId: 'whirlpool_tl_dd_5100',
  });
  assert.ok(tl5100Family);
  assert.equal(tl5100Family?.platformFamilyId, 'whirlpool_tl_dd_5100_direct_drive');

  assert.ok(
    tl5100Resolved.procedureBindings.some((binding) => binding.procedureId?.startsWith('w11416787')),
    '5100 graph should include W11416787 procedure bindings',
  );
  assert.ok(
    !tl5100Resolved.procedureBindings.some((binding) => binding.procedureId?.startsWith('w10864849')),
    '5100 graph must not include W10864849 procedure bindings',
  );
  assert.ok(
    !tl5100Resolved.procedureBindings.some((binding) => binding.procedureId?.startsWith('w8178558')),
    '5100 graph must not include FL Duet Sport procedure bindings',
  );
}

runCg5TlArchitectureBoundary();
console.log('cg5-tl-architecture-boundary: OK');
