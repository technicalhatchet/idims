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
import whirlpoolFrontLoadWasherOverlay from '../../../knowledge/canonical/manufacturer_overlays/whirlpool_front_load_washer.json';
import whirlpoolTopLoadWasherOverlay from '../../../knowledge/canonical/manufacturer_overlays/whirlpool_top_load_washer.json';

const SAMSUNG_FL_INPUT = {
  templateId: 'washer',
  manufacturer: 'Samsung',
  model: 'WF53BB8700',
  platformId: 'samsung_fl_washer_bb8700',
};

const WHIRLPOOL_FL_PROCEDURE_PREFIXES = ['w8178558', 'w11169652'];
const WHIRLPOOL_TL_PROCEDURE_PREFIXES = ['w10864849', 'w11697231', 'w11416787'];
const WHIRLPOOL_OEM_ALIASES = [
  'TEST #6: Water Level',
  'TEST #8: Lid Lock',
  'TEST #3a: Drive System — Shifter',
  'TEST #9: Load & Go Detergent',
];

function runCg5SamsungFlArchitectureBoundary(): void {
  assert.equal(
    resolveCanonicalOntologyId('washer', 'samsung_fl_washer_bb8700'),
    'front_load_washer',
  );

  const flOntology = getCanonicalOntologyForTemplate('washer', 'samsung_fl_washer_bb8700');
  assert.ok(flOntology);
  assert.equal(flOntology?.ontology.id, 'front_load_washer');

  const samsungResolved = resolveDiagnosticGraph(SAMSUNG_FL_INPUT);
  assert.ok(samsungResolved);
  assert.equal(samsungResolved.resolution.canonicalOntologyId, 'front_load_washer');
  assert.equal(samsungResolved.resolution.manufacturer, 'Samsung');
  assert.equal(samsungResolved.resolution.platformFamilyId, 'samsung_fl_bb8700_direct_drive');

  for (const layer of samsungResolved.resolution.layers) {
    assert.ok(!layer.includes('Whirlpool'), `Samsung graph must not load Whirlpool layer: ${layer}`);
    assert.ok(!layer.startsWith('platform:whirlpool'), `Samsung graph must not load Whirlpool platform: ${layer}`);
  }

  for (const overlay of [whirlpoolFrontLoadWasherOverlay, whirlpoolTopLoadWasherOverlay]) {
    const family = selectPlatformFamilyOverlay(overlay as never, SAMSUNG_FL_INPUT);
    assert.equal(family, null, `Whirlpool overlay must not apply to Samsung FL (${overlay.manufacturer})`);

    for (const platformFamily of overlay.platformFamilies || []) {
      assert.equal(
        platformFamilyApplies(platformFamily as never, SAMSUNG_FL_INPUT),
        false,
        `Whirlpool family ${platformFamily.platformFamilyId} must not apply to Samsung FL`,
      );
    }
  }

  for (const alias of WHIRLPOOL_OEM_ALIASES) {
    assert.equal(
      samsungResolved.oemTermAliases[alias],
      undefined,
      `Samsung graph must not inherit Whirlpool OEM alias: ${alias}`,
    );
  }

  const allProcedureIds = samsungResolved.procedureBindings.map((binding) => binding.procedureId || '');
  for (const prefix of [...WHIRLPOOL_FL_PROCEDURE_PREFIXES, ...WHIRLPOOL_TL_PROCEDURE_PREFIXES]) {
    assert.ok(
      !allProcedureIds.some((procedureId) => procedureId.startsWith(prefix)),
      `Samsung graph must not include Whirlpool procedure bindings (${prefix}*)`,
    );
  }

  const flOverlays = getManufacturerOverlaysForOntology('front_load_washer');
  assert.ok(flOverlays.length >= 2, 'FL ontology should register Whirlpool and Samsung manufacturer overlays');
  const whirlpoolFlOverlay = flOverlays.find((overlay) => overlay.manufacturer === 'Whirlpool');
  const samsungFlOverlay = flOverlays.find((overlay) => overlay.manufacturer === 'Samsung');
  assert.ok(samsungFlOverlay, 'Samsung FL manufacturer overlay must be registered');
  const samsungFamily = selectPlatformFamilyOverlay(samsungFlOverlay as never, SAMSUNG_FL_INPUT);
  assert.ok(samsungFamily);
  assert.equal(samsungFamily?.platformFamilyId, 'samsung_fl_bb8700_direct_drive');

  assert.equal(samsungResolved.oemTermAliases['§4-3: Power / current sense (9C5)'], 'inverter_board');
  assert.equal(samsungResolved.oemTermAliases['§4-3: Washing motor (3C)'], 'drive_motor');
  assert.ok(
    samsungResolved.procedureBindings.some((b) => b.procedureId === 'samsungbb8700-motor-circuit'),
    'Samsung graph must include BB8700 procedure bindings',
  );
  assert.ok(
    samsungResolved.components.some((c) => c.id === 'inverter_board'),
    'inverter_board must be platform additive component on Samsung graph',
  );
  assert.ok(whirlpoolFlOverlay);

  const whirlpoolFlOnSamsung = selectPlatformFamilyOverlay(whirlpoolFlOverlay as never, SAMSUNG_FL_INPUT);
  assert.equal(whirlpoolFlOnSamsung, null, 'Whirlpool FL platform family must not resolve for Samsung');

  const whirlpoolFlResolved = resolveDiagnosticGraph({
    templateId: 'washer',
    manufacturer: 'Whirlpool',
    model: 'WFW8300',
    platformId: 'whirlpool_duet_sport',
  });
  assert.ok(whirlpoolFlResolved);
  assert.ok(
    whirlpoolFlResolved.procedureBindings.some((binding) => binding.procedureId?.startsWith('w8178558')),
    'Whirlpool FL control case should still load its own procedure bindings',
  );
  assert.notEqual(
    whirlpoolFlResolved.resolution.canonicalOntologyId,
    'top_load_washer',
    'Whirlpool FL must remain on front_load_washer ontology',
  );
}

runCg5SamsungFlArchitectureBoundary();
console.log('cg5-samsung-fl-architecture-boundary: OK');
