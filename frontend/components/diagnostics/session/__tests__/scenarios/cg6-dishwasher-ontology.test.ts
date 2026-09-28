import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getCanonicalOntologyForTemplate,
  resolveCanonicalOntologyId,
} from '../../../knowledge/canonical/canonicalRegistry';
import { resolveDiagnosticGraph } from '../../../knowledge/canonical/resolveDiagnosticGraph';

test('dishwasher ontology resolves for dishwasher template', () => {
  assert.equal(resolveCanonicalOntologyId('dishwasher', 'whirlpool_dishwasher_acu'), 'dishwasher');

  const ontology = getCanonicalOntologyForTemplate('dishwasher', 'whirlpool_dishwasher_acu');
  assert.ok(ontology);
  assert.equal(ontology?.ontology.id, 'dishwasher');
  assert.equal(ontology?.ontology.frozen, true);
  assert.equal(ontology?.ontology.frozenRevision, 'rev1');
});

test('dishwasher platform id routes to dishwasher ontology', () => {
  assert.equal(resolveCanonicalOntologyId('dishwasher', 'samsung_dishwasher'), 'dishwasher');
  assert.equal(resolveCanonicalOntologyId('dishwasher', 'lg_dishwasher_ldt7808'), 'dishwasher');
});

test('dishwasher scaffold contains functional components without OEM-specific ids', () => {
  const ontology = getCanonicalOntologyForTemplate('dishwasher', 'whirlpool_dishwasher_acu');
  assert.ok(ontology);

  const componentIds = new Set(ontology!.components.map((component) => component.id));
  for (const id of [
    'power_supply',
    'control_board',
    'hmi_control',
    'door_switch',
    'inlet_valve',
    'water_level_sensor',
    'circulation_pump',
    'drain_pump',
    'heat_source',
    'thermal_protection',
    'temperature_sensor',
    'drying_system',
    'detergent_dispenser',
  ]) {
    assert.ok(componentIds.has(id), `missing canonical component ${id}`);
  }

  const deferredToOverlay = [
    'diverter_valve',
    'check_valve',
    'turbidity_sensor',
    'flow_meter',
    'wash_motor_capacitor',
  ];
  for (const id of deferredToOverlay) {
    assert.ok(!componentIds.has(id), `premature canonical component ${id}`);
  }
});

test('dishwasher no_heat entry point chains heating prerequisites', () => {
  const ontology = getCanonicalOntologyForTemplate('dishwasher', 'whirlpool_dishwasher_acu');
  assert.ok(ontology);

  const noHeat = ontology!.diagnosticEntryPoints.find((entry) => entry.id === 'no_heat');
  assert.ok(noHeat);
  assert.ok(noHeat!.initialDomains?.includes('heating_failure'));
  assert.ok(noHeat!.activeGoals?.includes('heating_operation'));

  const heaterCommand = ontology!.testTargets?.find((target) => target.id === 'heater_command_test');
  assert.ok(heaterCommand);
  assert.deepEqual(heaterCommand!.requires?.facts, [
    'water_level_reached',
    'circulation_present',
    'door_closed_authorized',
  ]);
});

test('dishwasher wont_drain entry point targets drain operation goal', () => {
  const ontology = getCanonicalOntologyForTemplate('dishwasher', 'whirlpool_dishwasher_acu');
  assert.ok(ontology);

  const wontDrain = ontology!.diagnosticEntryPoints.find((entry) => entry.id === 'wont_drain');
  assert.ok(wontDrain);
  assert.ok(wontDrain!.initialDomains?.includes('drain_failure'));
  assert.ok(wontDrain!.activeGoals?.includes('drain_operation'));

  const drainTest = ontology!.testTargets?.find((target) => target.id === 'drain_test');
  assert.ok(drainTest);
  assert.ok(drainTest!.establishesFacts?.includes('drain_command_present'));
});

test('dishwasher graph resolves canonical and Whirlpool ACU overlay for W11633848 platform', () => {
  const resolved = resolveDiagnosticGraph({
    templateId: 'dishwasher',
    platformId: 'whirlpool_dishwasher_acu',
    manufacturer: 'Whirlpool',
    model: 'WDT750SAKZ',
  });

  assert.ok(resolved);
  assert.equal(resolved!.ontology.id, 'dishwasher');
  assert.ok(resolved!.resolution.layers.includes('canonical'));
  assert.ok(resolved!.resolution.layers.includes('platform:whirlpool_dishwasher_acu'));
  assert.ok(resolved!.components.some((component) => component.id === 'circulation_pump'));
  assert.ok(resolved!.components.some((component) => component.id === 'water_level_sensor'));
  assert.ok(resolved!.components.some((component) => component.id === 'owi_sensor'));
  assert.ok(!resolved!.components.some((component) => component.id === 'diverter_valve'));
  assert.ok(resolved!.testTargets?.some((target) => target.id === 'heater_command_test'));
  assert.equal(resolved!.oemTermAliases['f500 triac load fuse'], 'thermal_protection');
});
