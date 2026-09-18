import assert from 'node:assert/strict';
import { test } from 'node:test';

import dishwasherOntology from '../../../knowledge/canonical/dishwasher.json';
import samsungDishwasherOverlay from '../../../knowledge/canonical/manufacturer_overlays/samsung_dishwasher.json';
import whirlpoolDishwasherOverlay from '../../../knowledge/canonical/manufacturer_overlays/whirlpool_dishwasher.json';
import whirlpoolFrontLoadWasherOverlay from '../../../knowledge/canonical/manufacturer_overlays/whirlpool_front_load_washer.json';
import whirlpoolTopLoadWasherOverlay from '../../../knowledge/canonical/manufacturer_overlays/whirlpool_top_load_washer.json';
import whirlpoolVentedDryerOverlay from '../../../knowledge/canonical/manufacturer_overlays/whirlpool_vented_dryer.json';
import {
  getCanonicalOntologyForTemplate,
  resolveCanonicalOntologyId,
} from '../../../knowledge/canonical/canonicalRegistry';
import type { CanonicalRelationship } from '../../../knowledge/canonical/canonicalTypes';
import {
  getManufacturerOverlaysForOntology,
  platformFamilyApplies,
  resolveDiagnosticGraph,
  selectPlatformFamilyOverlay,
} from '../../../knowledge/canonical/resolveDiagnosticGraph';

const ACU_INPUT = {
  templateId: 'dishwasher',
  manufacturer: 'Whirlpool',
  model: 'WDT750SAKZ',
  platformId: 'whirlpool_dishwasher_acu',
};

const WASHER_DRYER_OVERLAYS = [
  whirlpoolFrontLoadWasherOverlay,
  whirlpoolTopLoadWasherOverlay,
  whirlpoolVentedDryerOverlay,
];

function componentIds(graph: { components: Array<{ id: string }> }): Set<string> {
  return new Set(graph.components.map((component) => component.id));
}

function implementsTargets(
  relationships: CanonicalRelationship[],
  fromId: string,
): string[] {
  return relationships
    .filter((relationship) => relationship.from === fromId && relationship.type === 'implements')
    .map((relationship) => relationship.to);
}

test('whirlpool_dishwasher_acu resolves to dishwasher canonical ontology', () => {
  assert.equal(resolveCanonicalOntologyId('dishwasher', 'whirlpool_dishwasher_acu'), 'dishwasher');

  const ontology = getCanonicalOntologyForTemplate('dishwasher', 'whirlpool_dishwasher_acu');
  assert.ok(ontology);
  assert.equal(ontology?.ontology.id, 'dishwasher');
  assert.equal(ontology?.ontology.frozen, true);
  assert.equal(ontology?.ontology.frozenRevision, 'rev1');
});

test('dishwasher graph does not load washer or dryer manufacturer overlays', () => {
  const resolved = resolveDiagnosticGraph(ACU_INPUT);
  assert.ok(resolved);
  assert.equal(resolved.resolution.canonicalOntologyId, 'dishwasher');

  for (const layer of resolved.resolution.layers) {
    assert.ok(!layer.includes('front_load_washer'), `must not load FL washer layer: ${layer}`);
    assert.ok(!layer.includes('top_load_washer'), `must not load TL washer layer: ${layer}`);
    assert.ok(!layer.includes('vented_dryer'), `must not load dryer layer: ${layer}`);
  }

  for (const overlay of WASHER_DRYER_OVERLAYS) {
    const family = selectPlatformFamilyOverlay(overlay as never, ACU_INPUT);
    assert.equal(family, null, `${overlay.manufacturer} ${overlay.canonicalOntologyId} must not apply`);

    for (const platformFamily of overlay.platformFamilies || []) {
      assert.equal(
        platformFamilyApplies(platformFamily as never, ACU_INPUT),
        false,
        `family ${platformFamily.platformFamilyId} must not apply to dishwasher ACU`,
      );
    }
  }

  const dishwasherOverlays = getManufacturerOverlaysForOntology('dishwasher');
  assert.equal(dishwasherOverlays.length, 2);
  assert.deepEqual(
    new Set(dishwasherOverlays.map((overlay) => overlay.manufacturer)),
    new Set(['Whirlpool', 'Samsung']),
  );
  for (const overlay of dishwasherOverlays) {
    assert.equal(overlay.canonicalOntologyId, 'dishwasher');
  }
});

test('platform implementation stays below canonical — no diverter_valve promotion', () => {
  const canonicalIds = componentIds(dishwasherOntology as never);
  assert.ok(!canonicalIds.has('diverter_valve'));
  assert.ok(!canonicalIds.has('diverter_motor'));
  assert.ok(!canonicalIds.has('owi_sensor'));
  assert.ok(!canonicalIds.has('vsm_wash_motor'));
  assert.ok(!canonicalIds.has('vsm_drain_motor'));

  const resolved = resolveDiagnosticGraph(ACU_INPUT);
  assert.ok(resolved);
  const resolvedIds = componentIds(resolved);

  assert.ok(resolvedIds.has('circulation_pump'));
  assert.ok(resolvedIds.has('diverter_motor'));
  assert.ok(resolvedIds.has('ssm_wash_motor'));
  assert.ok(resolvedIds.has('vsm_wash_motor'));
  assert.ok(resolvedIds.has('vsm_drain_motor'));
  assert.ok(resolvedIds.has('diverter_position_sensor'));
  assert.ok(!resolvedIds.has('diverter_valve'));

  const diverterMotorTargets = implementsTargets(resolved.relationships, 'diverter_motor');
  assert.deepEqual(diverterMotorTargets, ['circulation_pump']);

  const vsmWashTargets = implementsTargets(resolved.relationships, 'vsm_wash_motor');
  assert.deepEqual(vsmWashTargets, ['circulation_pump']);
  const vsmDrainTargets = implementsTargets(resolved.relationships, 'vsm_drain_motor');
  assert.deepEqual(vsmDrainTargets, ['drain_pump']);
});

test('owi_sensor remains platform-scoped with dual diagnostic roles', () => {
  const resolved = resolveDiagnosticGraph(ACU_INPUT);
  assert.ok(resolved);

  const owi = resolved.components.find((component) => component.id === 'owi_sensor');
  assert.ok(owi, 'owi_sensor must exist as platform implementation component');

  const dualRoleIds = (owi as { dualRoleCanonicalIds?: string[] }).dualRoleCanonicalIds;
  assert.deepEqual(dualRoleIds, ['water_level_sensor', 'temperature_sensor']);

  const owiTargets = implementsTargets(resolved.relationships, 'owi_sensor');
  assert.ok(owiTargets.includes('water_level_sensor'));
  assert.ok(owiTargets.includes('temperature_sensor'));
  assert.equal(owiTargets.length, 2);

  assert.equal(resolved.oemTermAliases.owi, undefined);
  assert.equal(resolved.oemTermAliases['owi / thermistor'], undefined);
  assert.equal(resolved.oemTermAliases['owi thermistor'], undefined);

  const roleBindings = (owi as {
    diagnosticRoleBindings?: Array<{ canonicalComponentId: string; testTargetId: string }>;
  }).diagnosticRoleBindings;
  assert.ok(roleBindings?.some(
    (binding) =>
      binding.canonicalComponentId === 'water_level_sensor'
      && binding.testTargetId === 'water_level_test',
  ));
  assert.ok(roleBindings?.some(
    (binding) =>
      binding.canonicalComponentId === 'temperature_sensor'
      && binding.testTargetId === 'temperature_response_test',
  ));

  const owiProcedure = resolved.procedureBindings.find(
    (binding) => binding.procedureId === 'w11633848-owi-sensor',
  );
  assert.equal(owiProcedure?.testTargetId, 'water_level_test');
  assert.equal(owiProcedure?.implementationComponent, 'owi_sensor');
});

test('deferred and rejected gate concepts are not manufacturer vocabulary', () => {
  const resolved = resolveDiagnosticGraph(ACU_INPUT);
  assert.ok(resolved);

  assert.equal(resolved.oemTermAliases.door_gasket, undefined);
  assert.equal(resolved.oemTermAliases['door gasket'], undefined);
  assert.equal(
    resolved.oemTermAliases['§3-10: Water Heating / Heat Dry'],
    undefined,
    'compound procedural title must not collapse heat_source and drying_system',
  );
  assert.equal(
    resolved.oemTermAliases['§3-6: ACU Power & DC Supplies'],
    undefined,
    'procedural title must bind by procedureId only',
  );

  assert.equal(resolved.oemTermAliases['f500 triac load fuse'], 'thermal_protection');
  assert.equal(resolved.oemTermAliases['triac fuse'], 'thermal_protection');

  const heaterBinding = resolved.procedureBindings.find(
    (binding) => binding.procedureId === 'w11633848-heater',
  );
  const dcFanBinding = resolved.procedureBindings.find(
    (binding) => binding.procedureId === 'w11633848-dc-fan',
  );
  assert.equal(heaterBinding?.testTargetId, 'heater_command_test');
  assert.ok(heaterBinding?.canonicalComponents?.includes('heat_source'));
  assert.equal(dcFanBinding?.testTargetId, 'drying_airflow_test');
  assert.ok(dcFanBinding?.canonicalComponents?.includes('drying_system'));
  assert.notEqual(heaterBinding?.testTargetId, dcFanBinding?.testTargetId);

  const triacBinding = resolved.procedureBindings.find(
    (binding) => binding.procedureId === 'w11633848-triac-fuse',
  );
  assert.equal(triacBinding?.testTargetId, 'thermal_protection_test');
  assert.ok(triacBinding?.canonicalComponents?.includes('thermal_protection'));
});

test('manufacturer overlay carries gated aliases without platform component promotion', () => {
  const family = whirlpoolDishwasherOverlay.platformFamilies[0];
  const aliasTargets = new Set(Object.values(family.oemTermAliases));
  const platformComponentIds = new Set(
    (family.add?.components || []).map((component) => component.id),
  );

  for (const platformId of platformComponentIds) {
    assert.ok(
      !aliasTargets.has(platformId),
      `platform component ${platformId} must not be an oemTermAlias target`,
    );
  }

  assert.equal(aliasTargets.size, 11, '11 distinct canonical targets from 15 gated alias keys');
  assert.ok(aliasTargets.has('circulation_pump'));
  assert.ok(aliasTargets.has('thermal_protection'));
  assert.ok(!aliasTargets.has('owi_sensor'));
});

test('resolved dishwasher graph loads Whirlpool ACU platform family', () => {
  const resolved = resolveDiagnosticGraph(ACU_INPUT);
  assert.ok(resolved);

  assert.equal(resolved.resolution.manufacturer, 'Whirlpool');
  assert.equal(resolved.resolution.platformFamilyId, 'whirlpool_dishwasher_acu');
  assert.equal(resolved.resolution.platformId, 'whirlpool_dishwasher_acu');
  assert.ok(resolved.resolution.layers.includes('manufacturer:Whirlpool'));
  assert.ok(resolved.resolution.layers.includes('platform:whirlpool_dishwasher_acu'));

  assert.ok(
    resolved.procedureBindings.some((binding) => binding.procedureId === 'w11633848-diverter-sensor'),
  );
  assert.ok(
    !resolved.procedureBindings.some((binding) => binding.procedureId?.startsWith('w8178558')),
  );
  assert.ok(
    !resolved.procedureBindings.some((binding) => binding.procedureId?.startsWith('w8178559')),
  );
});

test('W11480208 published bindings compound under frozen dishwasher rev1', () => {
  const resolved = resolveDiagnosticGraph({
    ...ACU_INPUT,
    model: 'WDT740SALB0',
  });
  assert.ok(resolved);

  const vsmWash = resolved.procedureBindings.find(
    (binding) => binding.procedureId === 'w11480208-wash-motor-vsm',
  );
  assert.equal(vsmWash?.testTargetId, 'circulation_test');
  assert.equal(vsmWash?.implementationComponent, 'vsm_wash_motor');

  const vsmDrain = resolved.procedureBindings.find(
    (binding) => binding.procedureId === 'w11480208-drain-motor-vsm',
  );
  assert.equal(vsmDrain?.testTargetId, 'drain_test');
  assert.equal(vsmDrain?.implementationComponent, 'vsm_drain_motor');

  const dcFan = resolved.procedureBindings.find(
    (binding) => binding.procedureId === 'w11480208-dc-fan',
  );
  assert.equal(dcFan?.testTargetId, 'drying_airflow_test');
  assert.equal(dcFan?.implementationComponent, 'dc_fan_motor');

  const overfill = resolved.procedureBindings.find(
    (binding) => binding.procedureId === 'w11480208-overfill-switch',
  );
  assert.equal(overfill?.testTargetId, 'water_level_test');

  assert.equal(
    resolved.procedureBindings.some(
      (binding) => binding.procedureId === 'w11480208-interior-led',
    ),
    false,
  );

  const w11633848Heater = resolved.procedureBindings.find(
    (binding) => binding.procedureId === 'w11633848-heater',
  );
  const w11480208Heater = resolved.procedureBindings.find(
    (binding) => binding.procedureId === 'w11480208-heater',
  );
  assert.equal(w11633848Heater?.testTargetId, 'heater_command_test');
  assert.equal(w11480208Heater?.testTargetId, 'heater_command_test');
});

test('W11499711 mechanical registration compounds SSM without VSM contamination', () => {
  const resolved = resolveDiagnosticGraph({
    ...ACU_INPUT,
    model: 'WDT750SAKB0',
  });
  assert.ok(resolved);

  const ssmNative = resolved.procedureBindings.find(
    (binding) => binding.procedureId === 'w11499711-wash-motor-ssm',
  );
  assert.equal(ssmNative?.testTargetId, 'circulation_test');
  assert.equal(ssmNative?.implementationComponent, 'ssm_wash_motor');

  const ssmAnchor = resolved.procedureBindings.find(
    (binding) => binding.procedureId === 'w11633848-wash-motor',
  );
  const vsmFiltration = resolved.procedureBindings.find(
    (binding) => binding.procedureId === 'w11480208-wash-motor-vsm',
  );
  assert.equal(ssmAnchor?.implementationComponent, 'ssm_wash_motor');
  assert.equal(vsmFiltration?.implementationComponent, 'vsm_wash_motor');

  const family = whirlpoolDishwasherOverlay.platformFamilies.find(
    (entry) => entry.platformFamilyId === 'whirlpool_dishwasher_acu',
  );
  assert.ok(family);
  assert.deepEqual(family?.compoundingManualIds, ['W11633848', 'W11480208', 'W11499711']);
});

const SAMSUNG_INPUT = {
  templateId: 'dishwasher',
  manufacturer: 'Samsung',
  model: 'DW80R5060US',
  platformId: 'samsung_dishwasher',
};

test('samsung_dishwasher resolves to frozen dishwasher rev1 without Whirlpool overlay', () => {
  const resolved = resolveDiagnosticGraph(SAMSUNG_INPUT);
  assert.ok(resolved);
  assert.equal(resolved.resolution.canonicalOntologyId, 'dishwasher');
  assert.equal(resolved.resolution.manufacturer, 'Samsung');
  assert.equal(resolved.resolution.platformFamilyId, 'samsung_dishwasher');

  assert.ok(resolved.resolution.layers.includes('manufacturer:Samsung'));
  assert.ok(!resolved.resolution.layers.includes('manufacturer:Whirlpool'));

  const resolvedIds = componentIds(resolved);
  assert.ok(resolvedIds.has('circulation_pump'));
  assert.ok(resolvedIds.has('distributor_motor'));
  assert.ok(resolvedIds.has('vent_fan_motor'));
  assert.ok(!resolvedIds.has('diverter_motor'));
  assert.ok(!resolvedIds.has('vsm_wash_motor'));
  assert.ok(!resolvedIds.has('ssm_wash_motor'));

  assert.equal(resolved.oemTermAliases['main pba'], 'control_board');
  assert.equal(resolved.oemTermAliases['distributor motor'], 'circulation_pump');
  assert.equal(resolved.oemTermAliases['diverter motor'], undefined);

  const distributorTargets = implementsTargets(resolved.relationships, 'distributor_motor');
  assert.deepEqual(distributorTargets, ['circulation_pump']);

  const dryFanTargets = implementsTargets(resolved.relationships, 'vent_fan_motor');
  assert.deepEqual(dryFanTargets, ['drying_system']);

  assert.equal(
    resolved.procedureBindings.some((binding) => binding.procedureId === 'samsungdw-communication'),
    false,
  );
  assert.equal(
    resolved.procedureBindings.some((binding) => binding.procedureId === 'samsungdw-power-supply'),
    false,
  );
  assert.equal(
    resolved.procedureBindings.filter((binding) => binding.procedureId?.startsWith('samsungdw-')).length,
    10,
  );
});

test('Samsung and Whirlpool dishwasher overlays remain manufacturer-isolated', () => {
  const whirlpoolFamily = whirlpoolDishwasherOverlay.platformFamilies.find(
    (entry) => entry.platformFamilyId === 'whirlpool_dishwasher_acu',
  );
  const samsungFamily = samsungDishwasherOverlay.platformFamilies.find(
    (entry) => entry.platformFamilyId === 'samsung_dishwasher',
  );
  assert.ok(whirlpoolFamily);
  assert.ok(samsungFamily);

  const whirlpoolProcedures = new Set(
    (whirlpoolFamily?.procedureBindings || []).map((binding) => binding.procedureId),
  );
  const samsungProcedures = new Set(
    (samsungFamily?.procedureBindings || []).map((binding) => binding.procedureId),
  );

  for (const procId of samsungProcedures) {
    assert.ok(
      !whirlpoolProcedures.has(procId),
      `Samsung procedure ${procId} must not appear in Whirlpool overlay`,
    );
  }

  const whirlpoolComponents = new Set(
    (whirlpoolFamily?.add?.components || []).map((component) => component.id),
  );
  const samsungComponents = new Set(
    (samsungFamily?.add?.components || []).map((component) => component.id),
  );

  for (const componentId of samsungComponents) {
    assert.ok(
      !whirlpoolComponents.has(componentId),
      `unexpected shared platform component ${componentId}`,
    );
  }
  assert.ok(samsungComponents.has('distributor_motor'));
  assert.ok(!samsungComponents.has('diverter_motor'));
  assert.ok(whirlpoolComponents.has('diverter_motor'));
  assert.ok(!whirlpoolComponents.has('distributor_motor'));
});
