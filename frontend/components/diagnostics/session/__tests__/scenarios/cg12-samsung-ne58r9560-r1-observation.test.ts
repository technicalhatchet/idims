import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const FROZEN_HASH = '0edfd0988fa4f782d946bc7e65089ad018bbb769851be0c6f30a701851e72d54';

const EXPECTED_PROBE_IDS = [
  'power_supply_induction',
  'control_board_induction',
  'user_interface_induction',
  'temperature_sensor_induction',
  'surface_heating_system_induction',
  'bake_instance_scope_induction',
  'broil_instance_scope_induction',
  'convection_heating_element_induction',
  'convection_fan_induction',
  'thermal_protection_induction',
  'oven_door_switch_induction',
];

test('CG-12 R1 observation is strictly observational from NE58H induction manual', () => {
  const obs = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_NE58R9560WS_IR_CG12X_OBSERVATION_v1.json'), 'utf8'),
  );
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG12_INDUCTION_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  assert.equal(obs.status, 'r1_observation_complete');
  assert.equal(obs.observationMode, 'strictly_observational');
  assert.equal(obs.ontologyConclusionsDeferred, true);
  assert.equal(obs.fitAnalysisDeferred, true);
  assert.equal(obs.smokeModel, 'NE58R9560WS/AA');
  assert.equal(obs.graphArtifacts.sourcePdf, 'backend/docs/manuals/samsunginductionne58h.pdf');
  assert.ok(obs.manualFamilyCoverage.modelPattern.includes('NE58*9560W*'));
  assert.equal(contract.discoveryCorpus.R1.observationStatus, 'complete');
  assert.equal(contract.discoveryCorpus.R1.sourcePdf, 'backend/docs/manuals/samsunginductionne58h.pdf');
  assert.equal(obs.ontologyUnderTest.hash, FROZEN_HASH);

  assert.ok(obs.explicitlyOmittedUntilFitAnalysis.includes('provisionalFitOutcome'));
  assert.equal(obs.recommendation, undefined);
  assert.equal(obs.centerpieceQuestionAnswer, undefined);
});

test('CG-12 R1 all 11 probes populated with observational fields and PENDING cross-manufacturer', () => {
  const obs = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_NE58R9560WS_IR_CG12X_OBSERVATION_v1.json'), 'utf8'),
  );

  const probes = obs.boundaryProbes as Record<
    string,
    {
      fitStatus: string;
      crossManufacturerConsistency: string;
      implementationEvidence: string | null;
      sourceProvenance: string[];
    }
  >;

  assert.equal(Object.keys(probes).length, 11);
  for (const id of EXPECTED_PROBE_IDS) {
    const probe = probes[id];
    assert.ok(probe, `missing probe ${id}`);
    assert.ok(probe.implementationEvidence);
    assert.ok(probe.sourceProvenance.length > 0);
    assert.equal(probe.crossManufacturerConsistency, 'PENDING');
    assert.notEqual(probe.fitStatus, 'DEFERRED');
    assert.notEqual(probe.fitStatus, 'DIVERGES');
  }

  assert.equal(obs.pipelineCounts.probesPopulated, 11);
  assert.equal(obs.classificationHistogram.DIVERGES, 0);
  assert.equal(obs.classificationHistogram.DEFERRED, 0);
  assert.equal(obs.observationalTallyOnly.divergenceCount, 0);
});

test('CG-12 R1 surface-heating probe records induction implementation without canonical topology', () => {
  const obs = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_NE58R9560WS_IR_CG12X_OBSERVATION_v1.json'), 'utf8'),
  );

  const surface = obs.boundaryProbes.surface_heating_system_induction;
  assert.equal(surface.criticalProbe, true);
  assert.equal(surface.fitStatus, 'INHERITS');
  assert.ok(surface.implementationEvidence.includes('Pan Detection'));
  assert.ok(surface.implementationEvidence.includes('IGBT'));
  assert.ok(surface.scrutinyNotes.topologyNotCanonical.includes('not canonical topology'));

  const control = obs.boundaryProbes.control_board_induction;
  assert.ok(control.topologyNotCanonical.includes('surface_heating_system'));

  const pan = obs.platformImplementationEvidence.observed.find(
    (p: { oemConcept: string }) => p.oemConcept === 'pan_detection',
  );
  assert.equal(pan.classification, 'PLATFORM_ONLY');
  assert.equal(obs.observationalTallyOnly.inductionHardwarePromotedToCanonical, false);
});

test('CG-12 R1 bake/broil instance scopes independently evidenced; convection element binds', () => {
  const obs = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_NE58R9560WS_IR_CG12X_OBSERVATION_v1.json'), 'utf8'),
  );

  const bake = obs.boundaryProbes.bake_instance_scope_induction;
  const broil = obs.boundaryProbes.broil_instance_scope_induction;
  const convEl = obs.boundaryProbes.convection_heating_element_induction;

  assert.equal(bake.fitStatus, 'INHERITS');
  assert.ok(bake.implementationEvidence.includes('Bake Heater'));
  assert.ok(bake.implementationEvidence.includes('240V'));

  assert.equal(broil.fitStatus, 'INHERITS');
  assert.ok(broil.implementationEvidence.includes('Broil Heater'));

  assert.equal(convEl.fitStatus, 'INHERITS');
  assert.ok(convEl.implementationEvidence.includes('Convection Heater'));
  assert.ok(convEl.conditionalScopeNote.includes('Evidenced on this configuration'));

  assert.equal(obs.observationalTallyOnly.allFiveCanonicalComponentsInherit, true);
  assert.equal(obs.observationalTallyOnly.bothInstanceScopesInherit, true);
});
