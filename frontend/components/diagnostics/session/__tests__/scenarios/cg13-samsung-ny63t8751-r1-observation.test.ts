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
  'power_supply_dual_fuel',
  'control_board_dual_fuel',
  'user_interface_dual_fuel',
  'temperature_sensor_dual_fuel',
  'surface_heating_system_dual_fuel',
  'bake_instance_scope_dual_fuel',
  'broil_instance_scope_dual_fuel',
  'convection_heating_element_dual_fuel',
  'convection_fan_dual_fuel',
  'thermal_protection_dual_fuel',
  'oven_door_switch_dual_fuel',
];

test('CG-13 R1 observation is strictly observational from NY63 dual-fuel manual', () => {
  const obs = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_NY63T8751SS_DF_CG13X_OBSERVATION_v1.json'), 'utf8'),
  );
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG13_DUAL_FUEL_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  assert.equal(obs.status, 'r1_observation_complete');
  assert.equal(obs.observationMode, 'strictly_observational');
  assert.equal(obs.ontologyConclusionsDeferred, true);
  assert.equal(obs.smokeModel, 'NY63T8751SS/AA');
  assert.equal(obs.fuelFilter, 'dual_fuel_range');
  assert.equal(obs.graphArtifacts.sourcePdf, 'backend/docs/manuals/samsungny64dualfuel.pdf');
  assert.ok(obs.manualFamilyCoverage.modelPattern.includes('NY63T8751'));
  assert.equal(contract.discoveryCorpus.R1.observationStatus, 'complete');
  assert.equal(contract.discoveryCorpus.R1.sourcePdf, 'backend/docs/manuals/samsungny64dualfuel.pdf');
  assert.equal(obs.ontologyUnderTest.hash, FROZEN_HASH);

  assert.ok(obs.explicitlyOmittedUntilHumanGate.includes('humanBoundaryApproval'));
  assert.equal(obs.recommendation, undefined);
  assert.equal(obs.centerpieceQuestionAnswer, undefined);
  assert.equal(obs.graphArtifacts.notNormalizationTarget, true);
});

test('CG-13 R1 all 11 probes populated with dual-energy-domain evidence', () => {
  const obs = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_NY63T8751SS_DF_CG13X_OBSERVATION_v1.json'), 'utf8'),
  );

  const probes = obs.boundaryProbes as Record<
    string,
    {
      fitStatus: string;
      crossManufacturerConsistency: string;
      implementationEvidence: string | null;
      sourceProvenance: string[];
      criticalProbe?: boolean;
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

  assert.equal(probes.surface_heating_system_dual_fuel.criticalProbe, true);
  assert.equal(probes.control_board_dual_fuel.criticalProbe, true);
  assert.ok(obs.dualEnergyArchitectureEvidence.surfacePath.includes('spark module'));
  assert.ok(obs.dualEnergyArchitectureEvidence.ovenPath.includes('bake'));

  assert.equal(obs.pipelineCounts.probesPopulated, 11);
  assert.equal(obs.classificationHistogram.DIVERGES, 0);
  assert.equal(obs.classificationHistogram.INHERITS, 9);
  assert.equal(obs.classificationHistogram.CONDITIONAL, 2);
  assert.equal(obs.observationalTallyOnly.divergenceCount, 0);
  assert.equal(obs.observationalTallyOnly.dualEnergyDomainsIndependentlyAddressable, true);
});

test('CG-13 R1 gas hardware recorded as PLATFORM_ONLY — not canonical promotion', () => {
  const obs = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_NY63T8751SS_DF_CG13X_OBSERVATION_v1.json'), 'utf8'),
  );

  const platform = obs.platformImplementationEvidence;
  assert.equal(platform.classification, 'PLATFORM_ONLY — recorded faithfully; not promoted to canonical');
  assert.ok(platform.observed.some((o: { oemConcept: string }) => o.oemConcept === 'valve_cooktop'));
  assert.ok(platform.observed.some((o: { oemConcept: string }) => o.oemConcept === 'spark_module'));
  assert.equal(obs.observationalTallyOnly.gasHardwarePromotedToCanonical, false);

  const surface = obs.boundaryProbes.surface_heating_system_dual_fuel;
  assert.ok(surface.implementationSpecificAdditions.includes('valve_cooktop'));
  assert.ok(surface.scrutinyNotes.topologyNotCanonical.includes('not canonical'));
});
