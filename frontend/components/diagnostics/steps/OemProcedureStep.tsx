'use client';

import type { WizardStepComponentProps } from '../../wizard/types';
import type { DiagnosticWizardContext } from '../types';
import { formatOemWizardSkipAcknowledgement } from '../procedures/procedureStepPresentation';
import { resolveProcedureRunPresentation } from '../procedures/procedureRunPresentation';
import {
  shouldShowOemWizardDecisionControls,
} from '../procedures/oemWizardDecisions';
import OemWizardProcedureOffer from '../procedures/ui/OemWizardProcedureOffer';
import { resolveDiagnosticForegroundState } from '../intelligence/diagnosticForegroundState';
import { BEFORE_REPAIR_CHECKS_DESCRIPTION } from '../shared/repairVerificationStepCopy';
import { getServiceProcedure } from '../procedures/procedureRegistry';
import { buildProcedureRecommendationForOffer } from '../procedures/resolveOemNextTestOffer';

type OemProcedureMeta = {
  stepKey?: string;
};

type OemProcedureContext = DiagnosticWizardContext & {
  oemProcedure?: {
    recommendation: import('../procedures/recommendServiceProcedures').ProcedureRecommendation | null;
    onStartProcedure: (procedureId: string) => void;
    onSkipOemWizardStep: () => void;
    onMarkOemWizardVerified?: () => void;
    onContinueAfterOemRepair?: () => void;
    onSaveAndViewResultsAfterOemRepair?: () => void;
    repairDecisionPending?: boolean;
    activeProcedureId: string | null;
    procedureRuns: Record<string, import('../procedures/types').ProcedureRunState>;
    wizardStepLabels?: Record<string, string>;
    lastOemWizardLeadDecision?: import('../procedures/oemWizardDecisions').OemWizardLeadDecisionKind | null;
    nextOemHandoff?: {
      previousProcedureTitle?: string | null;
      nextProcedureTitle?: string | null;
      targetProcedureId?: string | null;
    } | null;
    continuationOfferProcedureId?: string | null;
    oemWizardLeadDecisions?: import('../procedures/oemWizardDecisions').OemWizardLeadDecisions;
    oemDiagnosticTreeExhausted?: boolean;
  };
};

export default function OemProcedureStep({
  context,
  readOnly,
  variant = 'desktop',
}: WizardStepComponentProps<OemProcedureContext, OemProcedureMeta>) {
  const oem = context.oemProcedure;
  const intelligence = (context as { intelligence?: import('../intelligence/evidenceTypes').DiagnosticIntelligenceResult }).intelligence;
  const foregroundExhausted = oem?.oemDiagnosticTreeExhausted
    ? resolveDiagnosticForegroundState(intelligence, { procedureRuns: oem?.procedureRuns })
    : null;
  const diagnosticPayload = (context as DiagnosticWizardContext).payload;
  const pendingProcedureId = diagnosticPayload?.oemRepairDecisionPending
    || diagnosticPayload?.oemConfirmedRepairPathActive
    || null;
  let recommendation = oem?.recommendation;
  if (!recommendation && pendingProcedureId) {
    const procedure = getServiceProcedure(pendingProcedureId);
    if (procedure) {
      recommendation = {
        procedureId: pendingProcedureId,
        procedure,
        reason: 'Confirmed OEM fault',
        priority: 100,
      };
    }
  }

  const continuationOfferId = oem?.continuationOfferProcedureId
    || diagnosticPayload?.oemContinuationOfferProcedureId
    || oem?.nextOemHandoff?.targetProcedureId
    || null;
  const nextTestRecommendation = continuationOfferId
    ? buildProcedureRecommendationForOffer(continuationOfferId)
    : recommendation;

  const isMobile = variant === 'mobile';
  const faultProcedureId = pendingProcedureId || recommendation?.procedureId || null;
  const faultProcedureRun = faultProcedureId
    ? oem?.procedureRuns?.[faultProcedureId]
    : null;
  const faultCompletionPresentation = faultProcedureId && faultProcedureRun?.status === 'completed'
    ? resolveProcedureRunPresentation(faultProcedureId, faultProcedureRun)
    : null;
  const needsRepair = faultCompletionPresentation?.disposition === 'action_required';
  const awaitingRepairDecision = Boolean(needsRepair && oem?.repairDecisionPending);
  const findingExplanation = faultProcedureRun?.oemOutcome?.trim() || null;

  const offerProcedureId = nextTestRecommendation?.procedureId || null;
  const offerRun = offerProcedureId ? oem?.procedureRuns?.[offerProcedureId] : null;
  const offerIsComplete = offerRun?.status === 'completed';

  const hasActiveRunner = Boolean(oem?.activeProcedureId);
  const isActive = Boolean(
    offerProcedureId
    && oem?.activeProcedureId === offerProcedureId,
  );
  const showDecisionControls = shouldShowOemWizardDecisionControls({
    readOnly,
    hasActiveRunner,
    offeredProcedureId: offerProcedureId || recommendation?.procedureId,
    procedureRuns: oem?.procedureRuns,
    decisions: oem?.oemWizardLeadDecisions,
  });
  const showOfferPhase = !hasActiveRunner && !offerIsComplete && !awaitingRepairDecision;
  const nextOemHandoff = oem?.nextOemHandoff;
  const showHandoffSummary = Boolean(
    showOfferPhase
    && (nextOemHandoff || continuationOfferId)
    && !isActive,
  );

  const showFaultSummary = Boolean(
    awaitingRepairDecision
    && faultCompletionPresentation,
  );

  if (!recommendation && !continuationOfferId) {
    if (oem?.oemDiagnosticTreeExhausted) {
      return (
        <div
          className={`rounded-lg border px-3 py-3 text-sm ${
            isMobile
              ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-50'
              : 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-50'
          }`}
          data-oem-diagnostic-tree-exhausted
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-90">
            Manufacturer path complete
          </p>
          <p className="mt-2 leading-relaxed">
            No failed component was identified by the available manufacturer diagnostic procedures.
          </p>
          {foregroundExhausted?.detail ? (
            <p className="mt-2 text-sm leading-relaxed opacity-90">
              {foregroundExhausted.detail}
            </p>
          ) : null}
        </div>
      );
    }
    return (
      <p className={`text-sm ${isMobile ? 'text-gray-400' : 'text-gray-500'}`}>
        No OEM test is suggested for this complaint.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {showOfferPhase && !showHandoffSummary ? (
        <p className={`text-sm ${isMobile ? 'text-gray-300' : 'text-gray-700 dark:text-gray-300'}`}>
          Run the manufacturer&apos;s component test for this complaint before general mechanical checks.
        </p>
      ) : null}

      {showHandoffSummary ? (
        <div className="space-y-2" data-oem-test-complete-handoff>
          <div
            className={`rounded-lg border px-3 py-2.5 text-sm ${
              isMobile
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50'
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-90">
              OEM test complete
            </p>
            {nextOemHandoff?.previousProcedureTitle ? (
              <p className="mt-1 font-medium">{nextOemHandoff.previousProcedureTitle}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {oem?.lastOemWizardLeadDecision === 'skipped' ? (
        <p
          className={`text-sm ${isMobile ? 'text-gray-300' : 'text-gray-600 dark:text-gray-300'}`}
          data-oem-wizard-skip-ack
        >
          {formatOemWizardSkipAcknowledgement()}
        </p>
      ) : null}
      {oem?.lastOemWizardLeadDecision === 'user_verified' ? (
        <p
          className={`text-sm ${isMobile ? 'text-emerald-200/90' : 'text-emerald-700 dark:text-emerald-300'}`}
          data-oem-wizard-verified-ack
        >
          Already verified — continuing to the next diagnostic check.
        </p>
      ) : null}

      {showFaultSummary ? (
        <div
          className={`space-y-3 rounded-lg border px-3 py-3 ${
            isMobile
              ? 'border-red-500/35 bg-red-500/10'
              : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40'
          }`}
          data-oem-confirmed-finding
        >
          <p
            className={`text-[10px] font-semibold uppercase tracking-wide ${
              isMobile ? 'text-red-200/90' : 'text-red-700 dark:text-red-300'
            }`}
          >
            Fault identified
          </p>
          <p className={`text-sm font-medium ${isMobile ? 'text-gray-100' : 'text-gray-900 dark:text-gray-100'}`}>
            {faultCompletionPresentation?.headline || 'Component failure identified from this OEM test.'}
          </p>
          {faultProcedureId && getServiceProcedure(faultProcedureId)?.title ? (
            <p className={`text-xs ${isMobile ? 'text-gray-400' : 'text-gray-500'}`}>
              OEM test: {getServiceProcedure(faultProcedureId)?.title}
            </p>
          ) : null}
          {findingExplanation ? (
            <div className="space-y-1">
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${isMobile ? 'text-gray-400' : 'text-gray-500'}`}>
                What this means
              </p>
              <p className={`text-sm leading-relaxed ${isMobile ? 'text-gray-300' : 'text-gray-600 dark:text-gray-300'}`}>
                {findingExplanation}
              </p>
            </div>
          ) : null}
          <p className={`text-sm ${isMobile ? 'text-gray-300' : 'text-gray-600 dark:text-gray-300'}`}>
            {BEFORE_REPAIR_CHECKS_DESCRIPTION}
          </p>
          <div
            className={`rounded-md border px-2.5 py-2 text-xs ${
              isMobile
                ? 'border-white/10 bg-white/[0.03] text-gray-300'
                : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/40'
            }`}
            data-oem-repair-information
          >
            <p className="font-semibold uppercase tracking-wide opacity-90">Repair information</p>
            <p className="mt-1">
              Solomon identified the failed component.
            </p>
            {findingExplanation ? (
              <p className="mt-1 leading-relaxed">{findingExplanation}</p>
            ) : null}
            <p className="mt-1 leading-relaxed">
              Use the manufacturer&apos;s service documentation for the replacement procedure.
            </p>
          </div>
        </div>
      ) : null}

      {!showFaultSummary && offerIsComplete && !showOfferPhase ? (
        <div
          className={`rounded-lg border px-3 py-2.5 text-sm ${
            isMobile
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50'
          }`}
          data-oem-procedure-complete-summary
        >
          OEM test completed — use Next for the next manufacturer test.
        </div>
      ) : null}

      {showOfferPhase && nextTestRecommendation ? (
        <OemWizardProcedureOffer
          key={offerProcedureId || 'oem-offer'}
          recommendation={nextTestRecommendation}
          currentStepKey="oem_test"
          wizardStepLabels={oem?.wizardStepLabels}
          onStartProcedure={oem?.onStartProcedure || (() => {})}
          variant={variant}
          inWizardStep
          offerEyebrow={showHandoffSummary ? 'Next test' : 'Suggested OEM test'}
        />
      ) : null}

      {showDecisionControls ? (
        <div className="space-y-2">
          <p className={`text-xs ${isMobile ? 'text-gray-400' : 'text-gray-500'}`}>
            Skipping this test does not mean the component passed. Use &quot;Already verified&quot; only if you have already checked it yourself.
          </p>
          <button
            type="button"
            onClick={() => oem?.onMarkOemWizardVerified?.()}
            className={`w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
              isMobile
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15'
                : 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50'
            }`}
          >
            Already verified
          </button>
          <button
            type="button"
            onClick={() => oem?.onSkipOemWizardStep?.()}
            className={`w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
              isMobile
                ? 'border-white/10 bg-white/[0.03] text-gray-300 hover:bg-white/[0.06]'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
            }`}
          >
            Skip this test
          </button>
        </div>
      ) : null}
    </div>
  );
}
