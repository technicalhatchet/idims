import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getCanonicalOntologyForTemplate,
  resolveCanonicalOntologyId,
} from '../../../knowledge/canonical/canonicalRegistry';

test('french-door refrigerator ontology resolves for refrigerator template', () => {
  assert.equal(
    resolveCanonicalOntologyId('refrigerator', 'whirlpool_jazz_french_door'),
    'french_door_refrigerator',
  );

  const ontology = getCanonicalOntologyForTemplate('refrigerator', 'whirlpool_jazz_french_door');
  assert.ok(ontology);
  assert.equal(ontology?.ontology.id, 'french_door_refrigerator');
  assert.equal(ontology?.ontology.frozen, true);
  assert.equal(ontology?.ontology.frozenRevision, 'rev1');
});

test('refrigerator platform ids route to french_door_refrigerator ontology', () => {
  assert.equal(resolveCanonicalOntologyId('refrigerator', 'samsung_fridge_bespoke'), 'french_door_refrigerator');
  assert.equal(resolveCanonicalOntologyId('refrigerator', 'lg_lrmvs'), 'french_door_refrigerator');
});

test('rev1 contains only KEEP components — conditional concepts not in components[]', () => {
  const ontology = getCanonicalOntologyForTemplate('refrigerator', 'lg_lrmvs');
  assert.ok(ontology);

  const componentIds = new Set(ontology!.components.map((component) => component.id));
  for (const id of [
    'control_board',
    'user_interface',
    'door_switch',
    'evaporator_fan',
    'air_damper',
    'defrost_heater',
  ]) {
    assert.ok(componentIds.has(id), `missing KEEP component ${id}`);
  }

  const conditionalOnly = [
    'temperature_sensor',
    'compressor',
    'condenser_fan',
    'ice_maker',
    'water_dispenser',
  ];
  for (const id of conditionalOnly) {
    assert.ok(!componentIds.has(id), `conditional concept incorrectly in components[]: ${id}`);
  }

  const removed = ['airflow_path', 'defrost_system', 'cooling_system'];
  for (const id of removed) {
    assert.ok(!componentIds.has(id), `removed aggregate incorrectly in components[]: ${id}`);
  }

  const platformOnly = ['compressor_controller', 'defrost_sensor', 'sealed_system', 'water_inlet_valve'];
  for (const id of platformOnly) {
    assert.ok(!componentIds.has(id), `platform-only concept incorrectly in components[]: ${id}`);
  }
});

test('evaporator_fan and defrost_heater accept instance semantics', () => {
  const ontology = getCanonicalOntologyForTemplate('refrigerator', 'whirlpool_jazz_french_door');
  assert.ok(ontology);

  const evapFan = ontology!.components.find((c) => c.id === 'evaporator_fan');
  const defrostHeater = ontology!.components.find((c) => c.id === 'defrost_heater');
  assert.ok(evapFan);
  assert.ok(defrostHeater);

  const evapSemantics = (evapFan as { instanceSemantics?: { mayHaveInstances?: boolean } }).instanceSemantics;
  const heaterSemantics = (defrostHeater as { instanceSemantics?: { mayHaveInstances?: boolean } }).instanceSemantics;
  assert.equal(evapSemantics?.mayHaveInstances, true);
  assert.equal(heaterSemantics?.mayHaveInstances, true);
});

test('freeze provenance preserves controls trio R1/R2/R3 disposition history', () => {
  const ontology = getCanonicalOntologyForTemplate('refrigerator', 'samsung_fridge_bespoke');
  assert.ok(ontology);

  const provenance = (ontology as { freezeProvenance?: { controlsTrioDispositionHistory?: Record<string, unknown[]> } })
    .freezeProvenance;
  assert.ok(provenance?.controlsTrioDispositionHistory);

  for (const conceptId of ['control_board', 'user_interface', 'door_switch']) {
    const history = provenance!.controlsTrioDispositionHistory![conceptId];
    assert.ok(Array.isArray(history));
    assert.equal(history.length, 3);
    assert.equal((history[0] as { stage: string }).stage, 'R1');
    assert.equal((history[1] as { stage: string; disposition: string }).disposition, 'needs_second_manual');
    assert.equal((history[2] as { freeze?: string }).freeze, 'KEEP');
  }
});

test('not_cooling entry point targets airflow and refrigeration goals', () => {
  const ontology = getCanonicalOntologyForTemplate('refrigerator', 'lg_lrmvs');
  assert.ok(ontology);

  const notCooling = ontology!.diagnosticEntryPoints.find((entry) => entry.id === 'not_cooling');
  assert.ok(notCooling);
  assert.ok(notCooling!.initialDomains?.includes('airflow_failure'));
  assert.ok(notCooling!.activeGoals?.includes('refrigeration_operation'));
});
