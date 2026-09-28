import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getCanonicalOntologyForTemplate,
  resolveCanonicalOntologyId,
} from '../../../knowledge/canonical/canonicalRegistry';
import { resolveDiagnosticGraph } from '../../../knowledge/canonical/resolveDiagnosticGraph';

test('vented_dryer ontology resolves for electric and gas dryer templates', () => {
  assert.equal(resolveCanonicalOntologyId('electric_dryer', 'whirlpool_duet_sport_dryer'), 'vented_dryer');
  assert.equal(resolveCanonicalOntologyId('gas_dryer', 'whirlpool_duet_sport_dryer'), 'vented_dryer');

  const ontology = getCanonicalOntologyForTemplate('electric_dryer', 'whirlpool_duet_sport_dryer');
  assert.ok(ontology);
  assert.equal(ontology?.ontology.id, 'vented_dryer');
});

test('dryer platform id routes to vented_dryer even when templateId is washer', () => {
  assert.equal(resolveCanonicalOntologyId('washer', 'samsung_fl_dryer_bb8700'), 'vented_dryer');
  const ontology = getCanonicalOntologyForTemplate('washer', 'samsung_fl_dryer_bb8700');
  assert.ok(ontology);
  assert.equal(ontology?.ontology.id, 'vented_dryer');
});

test('samsung TL DV50 resolves vented_dryer ontology not top_load_washer', () => {
  assert.equal(resolveCanonicalOntologyId('electric_dryer', 'samsung_tl_dryer_dv50'), 'vented_dryer');
  assert.equal(resolveCanonicalOntologyId('gas_dryer', 'samsung_tl_dryer_dv50'), 'vented_dryer');
  assert.equal(resolveCanonicalOntologyId('washer', 'samsung_tl_dryer_dv50'), 'vented_dryer');

  const ontology = getCanonicalOntologyForTemplate('electric_dryer', 'samsung_tl_dryer_dv50');
  assert.ok(ontology);
  assert.equal(ontology?.ontology.id, 'vented_dryer');
  assert.notEqual(ontology?.ontology.id, 'top_load_washer');
});

test('vented_dryer scaffold contains canonical components without OEM-specific ids', () => {
  const ontology = getCanonicalOntologyForTemplate('electric_dryer', 'whirlpool_duet_sport_dryer');
  assert.ok(ontology);

  const componentIds = new Set(ontology!.components.map((component) => component.id));
  for (const id of [
    'power_supply',
    'control_board',
    'hmi_control',
    'door_switch',
    'drive_motor',
    'drum',
    'heat_source',
    'thermal_cutoff',
    'thermal_fuse',
    'temperature_sensor',
    'moisture_sensor',
    'blower',
    'lint_filter',
    'exhaust_path',
  ]) {
    assert.ok(componentIds.has(id), `missing canonical component ${id}`);
  }

  const forbidden = ['ccu', 'mcu', 'mce', 'j1', 'j14'];
  for (const id of componentIds) {
    assert.ok(!forbidden.includes(id), `OEM-specific id leaked into canonical graph: ${id}`);
  }
});

test('vented_dryer diagnostic entry points include no_heat goal with heating domains', () => {
  const ontology = getCanonicalOntologyForTemplate('electric_dryer', 'whirlpool_duet_sport_dryer');
  assert.ok(ontology);

  const noHeat = ontology!.diagnosticEntryPoints.find((entry) => entry.id === 'no_heat');
  assert.ok(noHeat);
  assert.ok(noHeat!.initialDomains.includes('heating_failure'));
  assert.ok(noHeat!.activeGoals?.includes('heating_operation'));
});

test('vented_dryer graph resolves Whirlpool overlay for W8178559 platform', () => {
  const resolved = resolveDiagnosticGraph({
    templateId: 'electric_dryer',
    platformId: 'whirlpool_duet_sport_dryer',
    manufacturer: 'Whirlpool',
    model: 'WED8300',
  });

  assert.ok(resolved);
  assert.equal(resolved!.ontology.id, 'vented_dryer');
  assert.ok(resolved!.resolution.layers.includes('manufacturer:Whirlpool'));
  assert.ok(
    resolved!.resolution.layers.some((layer) => layer.startsWith('platform:whirlpool_duet_sport')),
  );
  assert.ok(resolved!.components.some((component) => component.id === 'heat_source'));
  assert.ok(resolved!.components.some((component) => component.id === 'electric_heater'));
  assert.ok(resolved!.procedureBindings.some((binding) => binding.procedureId === 'w8178559-heater-electric'));
  assert.ok(resolved!.testTargets?.some((target) => target.id === 'heat_command_test'));
});

test('vented_dryer graph resolves CCU overlay for W10680150 platform', () => {
  const resolved = resolveDiagnosticGraph({
    templateId: 'electric_dryer',
    platformId: 'whirlpool_ccu_dryer',
    manufacturer: 'Whirlpool',
    model: 'WED5620',
  });

  assert.ok(resolved);
  assert.equal(resolved!.ontology.id, 'vented_dryer');
  assert.ok(resolved!.resolution.layers.includes('manufacturer:Whirlpool'));
  assert.ok(resolved!.resolution.layers.some((layer) => layer.includes('whirlpool_ccu_dryer')));
  assert.ok(resolved!.components.some((component) => component.id === 'heat_source'));
  assert.ok(resolved!.components.some((component) => component.id === 'electric_heater'));
  assert.ok(resolved!.procedureBindings.some((binding) => binding.procedureId === 'w10680150-heater-electric'));
  assert.ok(resolved!.procedureBindings.some((binding) => binding.procedureId === 'w8178559-heater-electric') === false);
});

test('vented_dryer graph resolves supplemental W10881701 bindings on shared CCU platform', () => {
  const resolved = resolveDiagnosticGraph({
    templateId: 'electric_dryer',
    platformId: 'whirlpool_ccu_dryer',
    manufacturer: 'Whirlpool',
    model: 'WED9500',
  });

  assert.ok(resolved);
  assert.ok(resolved!.procedureBindings.some((binding) => binding.procedureId === 'w10881701-water-valve'));
  assert.ok(resolved!.procedureBindings.some((binding) => binding.procedureId === 'w10881701-drum-led'));
  assert.ok(
    resolved!.measurementBindings?.some(
      (binding) =>
        binding.procedureId === 'w10881701-water-valve'
        && binding.measurementKnowledgeId === 'whirlpoolCcuDryerSteamValveOhms',
    ),
  );
  assert.ok(
    resolved!.measurementBindings?.some(
      (binding) =>
        binding.procedureId === 'w10881701-motor-circuit'
        && binding.testTargetId === 'motor_run_test',
    ),
  );
});

test('vented_dryer graph resolves Samsung BB8700 overlay for DVE53BB8700', () => {
  const resolved = resolveDiagnosticGraph({
    templateId: 'electric_dryer',
    platformId: 'samsung_fl_dryer_bb8700',
    manufacturer: 'Samsung',
    model: 'DVE53BB8700AWA1',
  });

  assert.ok(resolved);
  assert.equal(resolved!.ontology.id, 'vented_dryer');
  assert.ok(resolved!.resolution.layers.includes('manufacturer:Samsung'));
  assert.ok(resolved!.resolution.layers.some((layer) => layer.includes('samsung_fl_dryer_bb8700')));
  assert.ok(resolved!.procedureBindings.some((binding) => binding.procedureId === 'samsungbb8700-dryer-heater-electric'));
  assert.ok(
    resolved!.measurementBindings?.some(
      (binding) =>
        binding.procedureId === 'samsungbb8700-dryer-heater-electric'
        && binding.measurementKnowledgeId === 'samsungFlBb8700DryerHeaterOhms',
    ),
  );
  assert.ok(
    resolved!.procedureBindings.every(
      (binding) => !binding.procedureId.startsWith('samsungdv6000-'),
    ),
  );
});

test('vented_dryer graph resolves Samsung DV6000 overlay for DVE45T6000', () => {
  const resolved = resolveDiagnosticGraph({
    templateId: 'electric_dryer',
    platformId: 'samsung_fl_dryer_dv6000',
    manufacturer: 'Samsung',
    model: 'DVE45T6000AW',
  });

  assert.ok(resolved);
  assert.equal(resolved!.ontology.id, 'vented_dryer');
  assert.ok(resolved!.resolution.layers.includes('manufacturer:Samsung'));
  assert.ok(resolved!.resolution.layers.some((layer) => layer.includes('samsung_fl_dryer_dv6000')));
  assert.ok(resolved!.procedureBindings.some((binding) => binding.procedureId === 'samsungdv6000-heater-electric'));
  assert.ok(
    resolved!.measurementBindings?.some(
      (binding) =>
        binding.procedureId === 'samsungdv6000-heater-electric'
        && binding.measurementKnowledgeId === 'samsungFlDv6000DryerHeaterSingleOhms',
    ),
  );
  assert.ok(
    resolved!.measurementBindings?.some(
      (binding) =>
        binding.procedureId === 'samsungdv6000-motor-circuit'
        && binding.measurementKnowledgeId === 'samsungFlDv6000DryerMotorWinding34Ohms'
        && binding.testTargetId === 'motor_run_test',
    ),
  );
  assert.ok(
    resolved!.procedureBindings.every(
      (binding) => !binding.procedureId.startsWith('samsungbb8700-dryer-'),
    ),
  );
});

test('vented_dryer graph resolves Samsung TL DV50 overlay for DVE50R5200', () => {
  const resolved = resolveDiagnosticGraph({
    templateId: 'electric_dryer',
    platformId: 'samsung_tl_dryer_dv50',
    manufacturer: 'Samsung',
    model: 'DVE50R5200AW',
  });

  assert.ok(resolved);
  assert.equal(resolved!.ontology.id, 'vented_dryer');
  assert.ok(resolved!.resolution.layers.includes('manufacturer:Samsung'));
  assert.ok(resolved!.resolution.layers.some((layer) => layer.includes('samsung_tl_dryer_dv50')));
  assert.ok(resolved!.procedureBindings.some((binding) => binding.procedureId === 'samsungtldv50-heater-electric'));
  assert.ok(
    resolved!.measurementBindings?.some(
      (binding) =>
        binding.procedureId === 'samsungtldv50-motor-circuit'
        && binding.measurementKnowledgeId === 'samsungTlDv50DryerMotorWinding34Ohms'
        && binding.testTargetId === 'motor_run_test',
    ),
  );
});

test('samsung vented dryer platform families do not cross-bind procedures', () => {
  const bb8700 = resolveDiagnosticGraph({
    templateId: 'electric_dryer',
    platformId: 'samsung_fl_dryer_bb8700',
    manufacturer: 'Samsung',
    model: 'DVE53BB8700AW',
  });
  const dv6000 = resolveDiagnosticGraph({
    templateId: 'electric_dryer',
    platformId: 'samsung_fl_dryer_dv6000',
    manufacturer: 'Samsung',
    model: 'DVE45T6000AW',
  });
  const tlDv50 = resolveDiagnosticGraph({
    templateId: 'electric_dryer',
    platformId: 'samsung_tl_dryer_dv50',
    manufacturer: 'Samsung',
    model: 'DVE50R5200AW',
  });

  assert.ok(bb8700);
  assert.ok(dv6000);
  assert.ok(tlDv50);

  for (const graph of [bb8700!, dv6000!, tlDv50!]) {
    assert.equal(graph.ontology.id, 'vented_dryer');
    assert.equal(graph.oemTermAliases.supply, 'power_supply');
    assert.equal(graph.oemTermAliases.main_control, 'control_board');
  }

  const allProcedureIds = [
    ...bb8700!.procedureBindings.map((b) => b.procedureId),
    ...dv6000!.procedureBindings.map((b) => b.procedureId),
    ...tlDv50!.procedureBindings.map((b) => b.procedureId),
  ];
  assert.equal(new Set(allProcedureIds).size, allProcedureIds.length);

  assert.ok(bb8700!.procedureBindings.every((b) => b.procedureId.startsWith('samsungbb8700-dryer-')));
  assert.ok(dv6000!.procedureBindings.every((b) => b.procedureId.startsWith('samsungdv6000-')));
  assert.ok(tlDv50!.procedureBindings.every((b) => b.procedureId.startsWith('samsungtldv50-')));

  assert.notEqual(
    bb8700!.displayTerms?.electric_heater,
    dv6000!.displayTerms?.electric_heater,
  );
  assert.notEqual(
    bb8700!.displayTerms?.drive_motor,
    tlDv50!.displayTerms?.drive_motor,
  );
});

test('vented_dryer thermal protection and airflow topology are directionally correct', () => {
  const ontology = getCanonicalOntologyForTemplate('electric_dryer', 'whirlpool_duet_sport_dryer');
  assert.ok(ontology);

  const relationships = ontology!.relationships;
  assert.ok(
    relationships.some(
      (rel) =>
        rel.from === 'heat_source'
        && rel.type === 'protected_by'
        && rel.to === 'thermal_fuse',
    ),
  );
  assert.ok(
    relationships.some(
      (rel) =>
        rel.from === 'heat_source'
        && rel.type === 'routed_through'
        && rel.to === 'drum',
    ),
  );
  assert.ok(
    relationships.some(
      (rel) =>
        rel.from === 'drum'
        && rel.type === 'routed_through'
        && rel.to === 'lint_filter',
    ),
  );
  assert.ok(
    relationships.some(
      (rel) =>
        rel.from === 'lint_filter'
        && rel.type === 'routed_through'
        && rel.to === 'blower',
    ),
  );

  const exhaust = ontology!.components.find((c) => c.id === 'exhaust_path');
  assert.ok(exhaust);
  assert.ok(!exhaust!.aliases?.some((alias) => alias.includes('lint')));

  assert.ok(ontology!.componentStateModel);
  assert.equal(ontology!.componentStateModel!.intelligenceEngineMapping, undefined);
});
