import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getMeasurementKnowledge } from '../../knowledge/knowledgeRegistry';
import { formatRangeLabel } from '../../knowledge/measurementRulesEngine';
import type { ProcedureStep } from '../types';
import {
  formatInstructionLead,
  formatMeasurementResultPresentation,
  formatOemContinuationBridgeMessage,
  formatStepHeadline,
  resolveWhyWeAreChecking,
  splitInstructionPresentation,
} from '../procedureStepPresentation';

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

test('continuation bridge uses recommendation reason when present', () => {
  const message = formatOemContinuationBridgeMessage({
    recommendationReason: 'Complaint pattern matches Drain pump on this platform.',
    previousProcedureVerified: true,
  });
  assert.equal(message, 'Complaint pattern matches Drain pump on this platform.');
});

test('continuation bridge falls back safely without explanation', () => {
  const verified = formatOemContinuationBridgeMessage({
    previousProcedureVerified: true,
  });
  assert.match(verified, /normal range/i);

  const neutral = formatOemContinuationBridgeMessage({});
  assert.match(neutral, /continuing with the next diagnostic check/i);
});

test('formatInstructionLead detects R×1 shorthand', () => {
  const lead = formatInstructionLead('Set ohmmeter to R×1.');
  assert.equal(lead.changed, true);
  assert.match(lead.primary, /resistance/i);
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
