import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('CG-10 discovery contract is closed with freeze lock artifact', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG10_ELECTRIC_RANGE_ONTOLOGY_DISCOVERY_CONTRACT_v1.json'), 'utf8'),
  );

  assert.equal(contract.status, 'closed');
  assert.equal(contract.phase, 'CG-10');
  assert.equal(contract.closureArtifact, 'CG10_ELECTRIC_RANGE_FREEZE_LOCK_v1.json');
  assert.equal(contract.closureVerdict, 'CLOSED / ELECTRIC_RANGE_ARCHITECTURE_COMPLETE');
  assert.equal(contract.discoveryMode, 'ontology_boundary_discovery');
  assert.equal(contract.fuelScope, 'electric_range_only');
  assert.equal(contract.canonicalAuthoring.ontologyFile, 'electric_range.json');
  assert.equal(contract.canonicalAuthoring.frozen, true);
  assert.equal(contract.canonicalAuthoring.freezeLock, 'CG10_ELECTRIC_RANGE_FREEZE_LOCK_v1.json');
  assert.equal(contract.priorPhaseClosed, 'CG95_REFRIGERATOR_FAMILY_LOCK_v1.json');
  assert.equal(contract.discoveryCorpus.R1.manualId, 'W11746350');
  assert.equal(contract.discoveryCorpus.R2.manualId, 'LG-LRE-RANGE');
  assert.equal(contract.discoveryCorpus.R3.manualId, 'W11174426');
  assert.equal(contract.thirdManufacturerGap.status, 'closed_by_r4');
  assert.equal(contract.manufacturerBoundaryValidation.R4.manualId, 'SAMSUNG-NE58-RANGE');
  assert.equal(contract.manufacturerBoundaryValidation.R4.excludedFromDiscoveryCorpus, true);
  assert.ok((contract.boundaryQuestions as unknown[]).length >= 6);
});

test('CG-10 candidate graph is unfrozen with zero canonical components', () => {
  const candidate = JSON.parse(
    readFileSync(join(CALIBRATION, 'electric_range_oven_cg10x_candidate_v1.json'), 'utf8'),
  );

  assert.equal(candidate.ontology.frozen, false);
  assert.equal(candidate.ontology.id, 'electric_range_oven_candidate');
  assert.equal(candidate.components.length, 0);
  assert.ok((candidate.candidateConcepts as unknown[]).length >= 15);
  assert.ok(
    (candidate.candidateConcepts as { id: string }[]).some((c) => c.id === 'oven_heating_system'),
  );
  assert.ok(
    (candidate.candidateConcepts as { id: string }[]).some((c) => c.id === 'surface_heating_system'),
  );
  assert.ok((candidate.openQuestionsBeforeFreeze as unknown[]).length >= 4);
});

test('CG-10 R1 observation exists and does not recommend freeze', () => {
  const obs = JSON.parse(
    readFileSync(join(CALIBRATION, 'W11746350_er_cg10x_observation_v1.json'), 'utf8'),
  );

  assert.equal(obs.workstream, 'CG-10');
  assert.equal(obs.stage, 'R1_observation');
  assert.equal(obs.manualId, 'W11746350');
  assert.equal(obs.ontologyFrozen, false);
  assert.equal(obs.canonicalPromotionBlocked, true);
  assert.equal(obs.recommendation.freezeCandidateNow, false);
  assert.equal(obs.recommendation.nextManual, 'LG-LRE-RANGE');

  const evals = obs.conceptEvaluations as Record<string, { verdict: string }>;
  assert.equal(evals.power_supply.verdict, 'canonical_functional');
  assert.equal(evals.control_board.verdict, 'canonical_functional');
  assert.equal(evals.user_interface.verdict, 'canonical_functional');
  assert.equal(evals.oven_heating_system.verdict, 'needs_second_manual');
  assert.equal(evals.surface_heating_system.verdict, 'needs_second_manual');
});

test('CG-10 R2 LG observation uses invariant framing and rejects monolithic oven heat', () => {
  const r2 = JSON.parse(
    readFileSync(join(CALIBRATION, 'LG_LRE_RANGE_er_cg10x_observation_v1.json'), 'utf8'),
  );

  assert.equal(r2.stage, 'R2_manufacturer_boundary_test');
  assert.equal(r2.manualId, 'LG-LRE-RANGE');
  assert.equal(r2.freezeEligible, false);
  assert.equal(r2.recommendation.freezeCandidateNow, false);
  assert.equal(r2.r2DecisionGate.notAsked, 'Does LG match Whirlpool?');
  assert.ok(r2.r2DecisionGate.question.includes('invariant'));

  const r2Evals = r2.r2ConceptEvaluations as Record<string, { verdict: string }>;
  assert.equal(r2Evals.bake_heating_element.verdict, 'instance_functional_role');
  assert.equal(r2Evals.broil_heating_element.verdict, 'instance_functional_role');
  assert.equal(r2Evals.convection_heating_element.verdict, 'instance_functional_role');
  assert.equal(r2Evals.oven_heating_system.verdict, 'reject_monolithic_aggregate');
  assert.equal(r2Evals.temperature_sensor.verdict, 'canonical_functional');
  assert.equal(r2Evals.convection_fan.verdict, 'canonical_functional');

  const boundary = r2.boundaryEvaluations as Record<
    string,
    { crossManufacturerResult: string; candidateDisposition: string }
  >;
  assert.equal(
    boundary.oven_heating_system.crossManufacturerResult,
    'invariant_rejects_monolithic_aggregate',
  );
  assert.equal(
    boundary.bake_heating_element.crossManufacturerResult,
    'invariant_independent_element_decomposition',
  );
  assert.equal(
    boundary.bake_heating_element.candidateDisposition,
    'promote_instance_scopes_not_separate_canonical_nodes',
  );
  assert.equal(
    boundary.convection_heating_element.crossManufacturerResult,
    'r2_expands_electric_convection_evidence',
  );
});

test('CG-10 R3 LCX probe answers four platform questions and rejects infinite_switch canonical', () => {
  const r3 = JSON.parse(
    readFileSync(join(CALIBRATION, 'W11174426_er_cg10x_observation_v1.json'), 'utf8'),
  );
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG10_ELECTRIC_RANGE_ONTOLOGY_DISCOVERY_CONTRACT_v1.json'), 'utf8'),
  );

  assert.equal(r3.stage, 'R3_platform_architecture_falsification_probe');
  assert.equal(r3.recommendation.freezeCandidateNow, false);
  assert.equal(r3.r3DecisionGate.notAsked, 'Does LCX validate Copernicus?');

  const probes = r3.platformProbeAnswers as Array<{
    probeId: string;
    infiniteSwitchCanonicalGuard?: boolean;
    canonicalPromotion?: string;
  }>;
  const probeIds = new Set(probes.map((p) => p.probeId));
  for (const id of contract.r3PlatformProbes as string[]) {
    assert.ok(probeIds.has(id));
  }

  const surfaceControl = probes.find((p) => p.probeId === 'surface_control');
  assert.ok(surfaceControl?.infiniteSwitchCanonicalGuard);
  assert.equal(surfaceControl?.canonicalPromotion, 'rejected');

  const freeze = r3.freezeOutcomeRecommendation as { outcome: string; automaticFreeze: boolean };
  assert.equal(freeze.outcome, 'A');
  assert.equal(freeze.automaticFreeze, false);

  const synthesis = r3.triangulationSynthesis as {
    rejectedMonolithicAggregates: string[];
    instanceScopedHeatGeneration: string[];
  };
  assert.ok(synthesis.rejectedMonolithicAggregates.includes('oven_heating_system'));
  assert.ok(synthesis.instanceScopedHeatGeneration.includes('bake_heating_element'));
});

test('CG-10 R4 Samsung NE58 validates post-R3 hypothesis and rejects Samsung hardware canonical promotion', () => {
  const r4 = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_NE58_RANGE_er_cg10x_observation_v1.json'), 'utf8'),
  );
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG10_ELECTRIC_RANGE_ONTOLOGY_DISCOVERY_CONTRACT_v1.json'), 'utf8'),
  );

  assert.equal(r4.stage, 'R4_manufacturer_boundary_validation');
  assert.equal(r4.recommendation.freezeCandidateNow, false);
  assert.equal(r4.r4DecisionGate.evaluatedAgainst, 'post_r3_triangulation_synthesis');
  assert.equal(r4.discoveryCorpusNote.excludedFromDiscoveryCorpus, true);
  assert.equal(r4.graphArtifacts.extractionMethod, 'extract_pdf.py');
  assert.ok(String(r4.graphArtifacts.sourcePdf).includes('SamsunNE58F electric range.pdf'));

  const mfg = contract.manufacturerBoundaryValidation as { R4: { excludedFromDiscoveryCorpus: boolean } };
  assert.equal(mfg.R4.excludedFromDiscoveryCorpus, true);

  const probes = r4.manufacturerBoundaryProbes as Array<{
    probeId: string;
    hypothesisConfirmed?: boolean;
    samsungHardwareCanonicalGuard?: boolean;
  }>;
  const probeIds = new Set(probes.map((p) => p.probeId));
  for (const id of contract.r4ManufacturerBoundaryProbes as string[]) {
    assert.ok(probeIds.has(id));
  }
  assert.ok(probes.every((p) => p.hypothesisConfirmed));

  const guard = r4.samsungCanonicalPromotionGuard as { rejectedVocabulary: string[] };
  assert.ok(guard.rejectedVocabulary.includes('sub_pcb'));
  assert.ok(guard.rejectedVocabulary.includes('infinite_switch'));

  const validation = r4.hypothesisValidation as { manufacturerBoundaryPassed: boolean };
  assert.equal(validation.manufacturerBoundaryPassed, true);

  const freeze = r4.freezeOutcomeRecommendation as { outcome: string; automaticFreeze: boolean };
  assert.equal(freeze.outcome, 'A');
  assert.equal(freeze.automaticFreeze, false);

  const evals = r4.r4ConceptEvaluations as Record<string, { verdict: string }>;
  assert.equal(evals.oven_heating_system.verdict, 'reject_monolithic_aggregate');
  assert.equal(evals.bake_heating_element.verdict, 'instance_functional_role');
  assert.equal(evals.surface_control.verdict, 'platform_implementation');
});

test('CG-10 freeze recommendation derives dispositions from R1–R4 and links to frozen canonical', () => {
  const freeze = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG10_ELECTRIC_RANGE_FREEZE_RECOMMENDATION_v1.json'), 'utf8'),
  );
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG10_ELECTRIC_RANGE_ONTOLOGY_DISCOVERY_CONTRACT_v1.json'), 'utf8'),
  );

  assert.equal(freeze.status, 'recommendation_approved');
  assert.equal(freeze.humanApprovalRequired, false);
  assert.equal(freeze.canonicalOntologyFile, 'electric_range.json');
  assert.equal(freeze.canonicalOntologyFrozen, true);
  assert.equal(freeze.freezeLockArtifact, 'CG10_ELECTRIC_RANGE_FREEZE_LOCK_v1.json');
  assert.ok(freeze.humanFreezeApprovedAt);
  assert.equal(freeze.recommendedOutcome, 'A');
  assert.equal(contract.successCriteria.freezeRecommendationArtifact, 'CG10_ELECTRIC_RANGE_FREEZE_RECOMMENDATION_v1.json');

  const byId = Object.fromEntries(
    (freeze.conceptRecommendations as Array<{ conceptId: string; freezeRecommendation: string }>).map((r) => [
      r.conceptId,
      r.freezeRecommendation,
    ]),
  );

  assert.equal(byId.power_supply, 'KEEP');
  assert.equal(byId.control_board, 'KEEP');
  assert.equal(byId.user_interface, 'KEEP');
  assert.equal(byId.temperature_sensor, 'KEEP');
  assert.equal(byId.bake_heating_element, 'INSTANCE_SCOPE');
  assert.equal(byId.broil_heating_element, 'INSTANCE_SCOPE');
  assert.equal(byId.convection_heating_element, 'CONDITIONAL');
  assert.equal(byId.surface_heating_system, 'KEEP');
  assert.equal(byId.surface_control, 'PLATFORM_ONLY');
  assert.equal(byId.oven_heating_system, 'REMOVE');
  assert.equal(byId.convection_fan, 'CONDITIONAL');
  assert.equal(byId.cooling_fan, 'DEFER');
  assert.equal(byId.thermal_protection, 'CONDITIONAL');
  assert.equal(byId.oven_door_switch, 'CONDITIONAL');
  assert.equal(byId.oven_cavity, 'DEFER');

  const ovenHeat = freeze.conceptRecommendations.find(
    (r: { conceptId: string }) => r.conceptId === 'oven_heating_system',
  ) as { conditionalFlags: string[] };
  assert.ok(ovenHeat.conditionalFlags.length === 0);

  const convectionElement = freeze.conceptRecommendations.find(
    (r: { conceptId: string }) => r.conceptId === 'convection_heating_element',
  ) as { conditionalFlags: string[]; freezeSecondaryDisposition: string };
  assert.ok(convectionElement.conditionalFlags.length > 0);
  assert.equal(convectionElement.freezeSecondaryDisposition, 'INSTANCE_SCOPE');
});
