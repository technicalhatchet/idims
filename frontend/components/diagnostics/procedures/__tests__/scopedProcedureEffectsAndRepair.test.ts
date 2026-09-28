import assert from 'node:assert/strict';
import { evaluateDiagnosticIntelligence } from '../../intelligence/diagnosticIntelligenceEngine';
import { getComponentVerificationLevel } from '../../intelligence/componentVerification';
import { applyProcedureRunsToIntelligence } from '../applyProcedureDiagnosticEffects';
import { getEvidenceConfig } from '../../intelligence/evidenceRegistry';
import {
  repairHeadlineFromDiagnosticConclusion,
  resolveProcedureRepairHeadline,
  resolveProcedureRunDisposition,
} from '../procedureRunPresentation';
import { deriveProcedureDiagnosticConclusions } from '../deriveProcedureDiagnosticConclusions';
import { registerHarnessServiceProcedure } from '../procedureRegistry';
import {
  fixtureRunComponentGoodPathOpen,
  fixtureRunComponentOpenAtLoad,
  fixtureRunContradicted,
  fixtureRunLegacyUnscopedConfirm,
  SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE,
} from './fixtures/scopedEvidenceProcedureFixture';

function findComponentState(
  intelligence: ReturnType<typeof evaluateDiagnosticIntelligence> | null,
  componentId: string,
) {
  if (!intelligence) return null;
  for (const components of Object.values(intelligence.componentsByCategory || {})) {
    const match = components.find((item) => item.id === componentId);
    if (match) return match;
  }
  return null;
}

registerHarnessServiceProcedure(SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE);

function testScopedPathOpenDoesNotConfirmPump() {
  const config = getEvidenceConfig('washer');
  assert.ok(config);
  const categoryScores = new Map(config.categories.map((c) => [c.id, 0]));
  const componentScores = new Map();
  const ledger: import('../../intelligence/evidenceTypes').EvidenceLedgerEntry[] = [];

  applyProcedureRunsToIntelligence(
    config,
    { [SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE.id]: fixtureRunComponentGoodPathOpen() },
    categoryScores,
    componentScores,
    ledger,
  );

  const pump = componentScores.get('drain_pump');
  assert.ok(pump);
  assert.equal(pump.state, 'eliminated');
  assert.equal(getComponentVerificationLevel(pump.state), 'verified_good');
  assert.ok(ledger.some((entry) => entry.explanation.includes('path_open')));
}

function testRepairHeadlinePathFaultNotReplacePump() {
  const run = fixtureRunComponentGoodPathOpen();
  const headline = resolveProcedureRepairHeadline(SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE, run);
  assert.ok(headline);
  assert.match(headline, /Inspect\/repair/i);
  assert.match(headline, /circuit/i);
  assert.doesNotMatch(headline, /Replace drain pump/i);
}

function testRepairHeadlineComponentFailed() {
  const run = fixtureRunComponentOpenAtLoad();
  const headline = resolveProcedureRepairHeadline(SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE, run);
  assert.match(headline || '', /^Replace drain/i);
}

function testContradictedNoRepairHeadline() {
  const run = fixtureRunContradicted();
  const headline = resolveProcedureRepairHeadline(SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE, run);
  assert.equal(headline, null);
}

function testStructuredHeadlineWinsOverOemDisjunctive() {
  const run = fixtureRunComponentGoodPathOpen();
  const conclusion = deriveProcedureDiagnosticConclusions(run, SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE)[0];
  const headline = repairHeadlineFromDiagnosticConclusion(SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE, conclusion);
  assert.ok(headline?.includes('circuit'));
  assert.ok(conclusion.oemNarrative?.oemOutcome?.includes('replace pump or harness'));
  assert.doesNotMatch(headline || '', /Replace pump or harness/i);
}

function testLegacyUnscopedStillReplacePump() {
  const run = fixtureRunLegacyUnscopedConfirm();
  const headline = resolveProcedureRepairHeadline(SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE, run);
  assert.match(headline || '', /^Replace drain/i);
}

function testLegacyIntelligenceViaFullEngine() {
  const intelligence = evaluateDiagnosticIntelligence('washer', {}, undefined, {
    procedureRuns: {
      [SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE.id]: {
        ...fixtureRunLegacyUnscopedConfirm(),
        procedureId: SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE.id,
      },
    },
  });
  const pump = findComponentState(intelligence, 'drain_pump');
  assert.ok(pump);
  assert.equal(pump.state, 'confirmed');
}

function testScopedDispositionExternalPath() {
  const run = fixtureRunComponentGoodPathOpen();
  assert.equal(
    resolveProcedureRunDisposition(run, SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE),
    'action_required',
  );
}

function testScopedDispositionContradictedNoAutoRepairHeadline() {
  const run = fixtureRunContradicted();
  assert.equal(resolveProcedureRepairHeadline(SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE, run), null);
}

testScopedPathOpenDoesNotConfirmPump();
testRepairHeadlinePathFaultNotReplacePump();
testRepairHeadlineComponentFailed();
testContradictedNoRepairHeadline();
testStructuredHeadlineWinsOverOemDisjunctive();
testLegacyUnscopedStillReplacePump();
testLegacyIntelligenceViaFullEngine();
testScopedDispositionExternalPath();
testScopedDispositionContradictedNoAutoRepairHeadline();

console.log('scopedProcedureEffectsAndRepair.test.ts: ok');
