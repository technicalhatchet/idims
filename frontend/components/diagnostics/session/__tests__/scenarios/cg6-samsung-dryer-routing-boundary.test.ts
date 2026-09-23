import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  platformFamilyApplies,
  resolveDiagnosticGraph,
  selectPlatformFamilyOverlay,
} from '../../../knowledge/canonical/resolveDiagnosticGraph';
import samsungVentedDryerOverlay from '../../../knowledge/canonical/manufacturer_overlays/samsung_vented_dryer.json';

const COLLIDING_MODEL = 'DVE50R5200AW';

function findFamily(platformFamilyId: string) {
  const family = (samsungVentedDryerOverlay.platformFamilies || []).find(
    (item) => item.platformFamilyId === platformFamilyId,
  );
  assert.ok(family, `missing platform family ${platformFamilyId}`);
  return family!;
}

test('explicit platformId is authoritative — TL DV50 does not fall through to BB8700 model patterns', () => {
  const input = {
    templateId: 'electric_dryer',
    manufacturer: 'Samsung',
    model: COLLIDING_MODEL,
    platformId: 'samsung_tl_dryer_dv50',
  };

  const bb8700Family = findFamily('samsung_fl_dryer_bb8700');
  const tlDv50Family = findFamily('samsung_tl_dryer_dv50');

  assert.equal(platformFamilyApplies(bb8700Family, input), false);
  assert.equal(platformFamilyApplies(tlDv50Family, input), true);

  const selected = selectPlatformFamilyOverlay(samsungVentedDryerOverlay as never, input);
  assert.ok(selected);
  assert.equal(selected!.platformFamilyId, 'samsung_tl_dryer_dv50');

  const resolved = resolveDiagnosticGraph(input);
  assert.ok(resolved);
  assert.equal(resolved!.resolution.platformFamilyId, 'samsung_tl_dryer_dv50');
  assert.ok(
    resolved!.procedureBindings.every((binding) => binding.procedureId.startsWith('samsungtldv50-')),
  );
  assert.ok(
    resolved!.procedureBindings.every(
      (binding) => !binding.procedureId.startsWith('samsungbb8700-dryer-'),
    ),
  );
});

test('explicit platformId is authoritative — BB8700 keeps colliding model without TL fallthrough', () => {
  const input = {
    templateId: 'electric_dryer',
    manufacturer: 'Samsung',
    model: COLLIDING_MODEL,
    platformId: 'samsung_fl_dryer_bb8700',
  };

  const bb8700Family = findFamily('samsung_fl_dryer_bb8700');
  const tlDv50Family = findFamily('samsung_tl_dryer_dv50');

  assert.equal(platformFamilyApplies(bb8700Family, input), true);
  assert.equal(platformFamilyApplies(tlDv50Family, input), false);

  const selected = selectPlatformFamilyOverlay(samsungVentedDryerOverlay as never, input);
  assert.ok(selected);
  assert.equal(selected!.platformFamilyId, 'samsung_fl_dryer_bb8700');

  const resolved = resolveDiagnosticGraph(input);
  assert.ok(resolved);
  assert.equal(resolved!.resolution.platformFamilyId, 'samsung_fl_dryer_bb8700');
  assert.ok(
    resolved!.procedureBindings.every((binding) => binding.procedureId.startsWith('samsungbb8700-dryer-')),
  );
  assert.ok(
    resolved!.procedureBindings.every(
      (binding) => !binding.procedureId.startsWith('samsungtldv50-'),
    ),
  );
});

test('without explicit platformId, model patterns may route DVE50R5200 to TL DV50', () => {
  const input = {
    templateId: 'electric_dryer',
    manufacturer: 'Samsung',
    model: COLLIDING_MODEL,
  };

  const selected = selectPlatformFamilyOverlay(samsungVentedDryerOverlay as never, input);
  assert.ok(selected);
  assert.equal(selected!.platformFamilyId, 'samsung_tl_dryer_dv50');

  const resolved = resolveDiagnosticGraph(input);
  assert.ok(resolved);
  assert.equal(resolved!.resolution.platformFamilyId, 'samsung_tl_dryer_dv50');
  assert.ok(
    resolved!.procedureBindings.some((binding) => binding.procedureId === 'samsungtldv50-heater-electric'),
  );
});
