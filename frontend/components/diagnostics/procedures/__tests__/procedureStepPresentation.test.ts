import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getMeasurementKnowledge } from '../../knowledge/knowledgeRegistry';
import { formatRangeLabel } from '../../knowledge/measurementRulesEngine';
import type { ProcedureStep } from '../types';
import {
  buildProcedureStepPresentationContext,
  containsInternalDiagnosticJargon,
  formatInstructionLead,
  formatMeasurementResultPresentation,
  formatOemContinuationBridgeMessage,
  formatOemWizardSkipAcknowledgement,
  formatStepHeadline,
  isProcedureLevelRecommendationReason,
  parseStructuredInstructionLists,
  resolveWhyWeAreChecking,
  resolveWhyWeAreCheckingForStep,
  sanitizeUserFacingExplanation,
  splitInstructionPresentation,
} from '../procedureStepPresentation';
import { formatOemProcedureStepProgressLabel } from '../procedureRunDisplay';
import { getServiceProcedure } from '../procedureRegistry';
import { detectProcedureAutoManualForkById } from '../procedureAutoManualFork';

const DRAIN_PUMP_STEP: ProcedureStep = {
  id: 'pump_at_component',
  order: 4,
  type: 'measurement',
  title: 'Drain pump resistance at component',
  body: 'Set ohmmeter to R×1. Measure across drain pump terminals. Expected approximately 12.3 Ω.',
  sourceExcerpt:
    'Set ohmmeter to R×1. Measure across drain pump terminals. Expected approximately 12.3 Ω.',
  measurementKnowledgeId: 'whirlpoolDuetSportWasherDrainPumpOhms',
  requiresInput: true,
};

test('measurement step derives human-readable meter instruction while preserving OEM body separately', () => {
  const split = splitInstructionPresentation(DRAIN_PUMP_STEP.body || '');
  assert.match(split.whatToDo, /resistance/i);
  assert.equal(split.includeBodyInTechnical, true);
  assert.equal(split.meterRangeRef, 'R×1');
  assert.equal(
    DRAIN_PUMP_STEP.body,
    'Set ohmmeter to R×1. Measure across drain pump terminals. Expected approximately 12.3 Ω.',
  );
});

test('structured expected range remains authoritative from measurement knowledge', () => {
  const knowledge = getMeasurementKnowledge('whirlpoolDuetSportWasherDrainPumpOhms');
  assert.ok(knowledge?.ranges?.normal);
  const label = formatRangeLabel(knowledge!.ranges!.normal!, knowledge!.unit) || '';
  assert.match(label, /Ω/);
  assert.doesNotMatch(label, /12\.3/);
});

test('formatStepHeadline uppercases check-oriented measurement titles', () => {
  assert.equal(
    formatStepHeadline(DRAIN_PUMP_STEP),
    'CHECK DRAIN PUMP RESISTANCE AT COMPONENT',
  );
});

test('resolveWhyWeAreChecking returns null without sufficient context', () => {
  assert.equal(resolveWhyWeAreChecking(null, null), null);
  assert.equal(resolveWhyWeAreChecking({}, null), null);
});

test('resolveWhyWeAreChecking prefers recommendation reason', () => {
  const why = resolveWhyWeAreChecking({
    recommendationReason: 'Fault code F21 maps to Drain pump on this platform.',
  });
  assert.equal(why, 'Fault code F21 maps to Drain pump on this platform.');
});

test('buildProcedureStepPresentationContext returns undefined without resolvable why', () => {
  assert.equal(
    buildProcedureStepPresentationContext({
      reason: '',
      procedure: { title: '', componentIds: [] },
    }),
    undefined,
  );
});

test('buildProcedureStepPresentationContext mirrors recommendation reason for panel wiring', () => {
  const ctx = buildProcedureStepPresentationContext({
    reason: 'Fault code F21 maps to Drain pump on this platform.',
    procedure: { title: 'Drain pump', componentIds: ['drain_pump'] },
  });
  assert.equal(ctx?.recommendationReason, 'Fault code F21 maps to Drain pump on this platform.');
  assert.equal(
    resolveWhyWeAreChecking(ctx),
    'Fault code F21 maps to Drain pump on this platform.',
  );
});

test('formatMeasurementResultPresentation uses existing evaluation semantics', () => {
  const normal = formatMeasurementResultPresentation({
    knowledgeId: 'whirlpoolDuetSportWasherDrainPumpOhms',
    status: 'normal',
    message: 'Within expected range (11–14 Ω).',
    confidence: 'high',
    parsedValue: 12,
    rawValue: '12',
    displayUnit: 'Ω',
  });
  assert.equal(normal.headline, 'GOOD');
  assert.match(normal.detail, /Within expected range/);

  const open = formatMeasurementResultPresentation({
    knowledgeId: 'whirlpoolDuetSportWasherDrainPumpOhms',
    status: 'unknown',
    diagnosisLabel: 'Open circuit',
    message: 'OL detected at drain pump.',
    confidence: 'high',
    parsedValue: null,
    rawValue: 'OL',
    displayUnit: 'Ω',
  });
  assert.match(open.headline, /OPEN/i);
});

test('continuation bridge uses next procedure title only', () => {
  const message = formatOemContinuationBridgeMessage({
    nextProcedureTitle: 'Motor circuit',
    recommendationReason: 'This test checks the drain circuit before going deeper into the complaint.',
  });
  assert.equal(message, "Next, we'll test Motor circuit.");
  assert.doesNotMatch(message, /drain/i);
});

test('continuation bridge uses wizard step label when no OEM procedure', () => {
  const message = formatOemContinuationBridgeMessage({
    nextWizardStepLabel: 'Visual Inspection',
  });
  assert.equal(message, "Next, we'll continue with Visual Inspection.");
});

test('continuation bridge omits copy without a continuation target', () => {
  assert.equal(
    formatOemContinuationBridgeMessage({
      recommendationReason: 'This test checks the drain circuit before going deeper into the complaint.',
      previousProcedureVerified: true,
      previousProcedureTitle: 'Door lock',
    }),
    null,
  );
  assert.equal(formatOemContinuationBridgeMessage({}), null);
});

test('per-step why uses measurement purpose only, not procedure recommendation', () => {
  const motorReason =
    'This test checks the drive / motor circuit before going deeper into the complaint.';
  assert.equal(isProcedureLevelRecommendationReason(motorReason), true);
  const checkpointStep: ProcedureStep = {
    id: 'manual_test',
    order: 10,
    type: 'visual_check',
    title: 'Manual motor test',
    body: 'Run manual test.',
    requiresInput: true,
  };
  assert.equal(
    resolveWhyWeAreCheckingForStep(checkpointStep, null),
    null,
  );
  assert.equal(
    resolveWhyWeAreCheckingForStep(DRAIN_PUMP_STEP, 'Verify drain pump winding resistance.'),
    'Verify drain pump winding resistance.',
  );
  assert.equal(
    resolveWhyWeAreChecking(
      { recommendationReason: motorReason },
      null,
    ),
    motorReason,
  );
});

test('OEM procedure step label is distinct from Solomon stage wording', () => {
  const drain = getServiceProcedure('w8178558-drain-pump');
  const measurementStep = drain?.steps.find((step) => step.type === 'measurement');
  assert.ok(drain && measurementStep);
  assert.match(
    formatOemProcedureStepProgressLabel(4, 12, drain, measurementStep)!,
    /Component test step 4 of 12/i,
  );
  assert.equal(formatOemProcedureStepProgressLabel(12, 0), 'Procedure step 12');
});

test('W8178558 motor circuit has no structured auto/manual fork in seed data', () => {
  assert.equal(detectProcedureAutoManualForkById('w8178558-motor-circuit'), null);
});

test('formatInstructionLead detects R×1 shorthand', () => {
  const lead = formatInstructionLead('Set ohmmeter to R×1.');
  assert.equal(lead.changed, true);
  assert.match(lead.primary, /resistance/i);
});

test('sanitizeUserFacingExplanation drops canonical routing jargon', () => {
  const raw =
    'Canonical routing — Door / interlock, Control domain maps to 5-5: Door Lock / Switch Circuit.';
  assert.ok(containsInternalDiagnosticJargon(raw));
  const safe = sanitizeUserFacingExplanation(raw);
  assert.ok(safe);
  assert.ok(!containsInternalDiagnosticJargon(safe!));
  assert.match(safe!, /manufacturer test/i);
});

test('resolveWhyWeAreChecking omits unsafe recommendation reason', () => {
  const why = resolveWhyWeAreChecking({
    recommendationReason:
      'Canonical routing — Door / interlock, Control domain maps to door lock.',
    procedureTitle: 'Door lock',
    componentLabels: ['Door lock'],
  });
  assert.ok(why);
  assert.ok(!containsInternalDiagnosticJargon(why!));
});

test('parseStructuredInstructionLists formats manual test sequence without altering source', () => {
  const body = `Select any one key (except PAUSE/CANCEL). Press and hold 4 seconds → release 4 seconds.

Step sequence (first output is door lock):
1. Door locks (door lock system)
2. Main wash fill — both valves
3. Bleach fill — hot valve only

For this door-lock test, advance to step 1 and confirm the lock energizes.`;
  const parsed = parseStructuredInstructionLists(body);
  assert.ok(parsed?.testSequenceItems);
  assert.equal(parsed?.testSequenceItems?.length, 3);
  assert.match(parsed?.trailingText || '', /confirm the lock energizes/i);
  const split = splitInstructionPresentation(body);
  assert.equal(split.includeBodyInTechnical, true);
  assert.equal(split.testSequenceItems?.length, 3);
  assert.equal(body, body);
});

test('parseStructuredInstructionLists ignores arbitrary prose', () => {
  assert.equal(
    parseStructuredInstructionLists('Unplug the washer and wait thirty seconds before continuing.'),
    null,
  );
});

test('formatOemWizardSkipAcknowledgement does not imply verified-good', () => {
  const message = formatOemWizardSkipAcknowledgement();
  assert.match(message, /Skipped/i);
  assert.doesNotMatch(message, /verified|passed|good/i);
});

test('safety steps use distinct headline treatment without altering body text', () => {
  const safetyStep: ProcedureStep = {
    id: 'safety_power_off',
    order: 1,
    type: 'safety',
    title: 'Disconnect power',
    body: 'Unplug the washer or turn off the circuit breaker.',
  };
  assert.equal(formatStepHeadline(safetyStep), 'DISCONNECT POWER');
  assert.equal(safetyStep.body, 'Unplug the washer or turn off the circuit breaker.');
});
