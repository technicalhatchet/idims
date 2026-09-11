'use client';

import type { WizardStepComponentProps } from '../../wizard/types';
import type { DiagnosticWizardContext } from '../types';
import { resolveProcedureRunPresentation } from '../procedures/procedureRunPresentation';
import OemWizardProcedureOffer from '../procedures/ui/OemWizardProcedureOffer';

type OemProcedureMeta = {
  stepKey?: string;
};

type OemProcedureContext = DiagnosticWizardContext & {
  oemProcedure?: {
    recommendation: import('../procedures/recommendServiceProcedures').ProcedureRecommendation | null;
    onStartProcedure: (procedureId: string) => void;
    onSkipOemWizardStep: () => void;
    onContinueAfterOemRepair?: () => void;
    onSaveAndViewResultsAfterOemRepair?: () => void;
    repairDecisionPending?: boolean;
    activeProcedureId: string | null;
    procedureRuns: Record<string, import('../procedures/types').ProcedureRunState>;
    wizardStepLabels?: Record<string, string>;
  };
};

export default function OemProcedureStep({
  context,
  readOnly,
  variant = 'desktop',
}: WizardStepComponentProps<OemProcedureContext, OemProcedureMeta>) {
  const oem = context.oemProcedure;
  const recommendation = oem?.recommendation;
  const isMobile = variant === 'mobile';
  const procedureRun = recommendation
    ? oem?.procedureRuns?.[recommendation.procedureId]
    : null;
  const isComplete = procedureRun?.status === 'completed';
  const completionPresentation = recommendation && procedureRun?.status === 'completed'
    ? resolveProcedureRunPresentation(recommendation.procedureId, procedureRun)
    : null;
  const needsRepair = completionPresentation?.disposition === 'action_required';
  const awaitingRepairDecision = Boolean(needsRepair && oem?.repairDecisionPending);
  const isActive = Boolean(
    recommendation
    && oem?.activeProcedureId === recommendation.procedureId,
  );

  if (!recommendation) {
    return (
      <p className={`text-sm ${isMobile ? 'text-gray-400' : 'text-gray-500'}`}>
        No OEM test is suggested for this complaint.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className={`text-sm ${isMobile ? 'text-gray-300' : 'text-gray-700 dark:text-gray-300'}`}>
          Run the manufacturer&apos;s component test for this complaint before general mechanical checks.
          Measurements you enter here carry over to the wizard.
        </p>
      </div>

      {isActive ? (
        <div
          className={`rounded-lg border px-3 py-2.5 text-sm ${
            isMobile
              ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100'
              : 'border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-50'
          }`}
        >
          OEM test is open above — follow the procedure steps, then continue when finished.
        </div>
      ) : isComplete ? (
        <div className="space-y-3">
          <div
            className={`rounded-lg border px-3 py-2.5 text-sm ${
              needsRepair
                ? isMobile
                  ? 'border-red-500/30 bg-red-500/10 text-red-100'
                  : 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-50'
                : isMobile
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50'
            }`}
          >
            {needsRepair
              ? `Finding: ${completionPresentation?.headline || 'Repair action identified'}.`
              : 'OEM test complete. Use Next to continue with mechanical and control checks.'}
          </div>

          {awaitingRepairDecision ? (
            <div className="space-y-2">
              <p className={`text-sm ${isMobile ? 'text-gray-300' : 'text-gray-600 dark:text-gray-300'}`}>
                Continue checking other subsystems, or save now with root cause and recommended repair prefilled from this test.
              </p>
              {!readOnly ? (
                <>
                  <button
                    type="button"
                    onClick={() => oem?.onSaveAndViewResultsAfterOemRepair?.()}
                    className="w-full rounded-lg border border-[color:var(--solomon-primary-border)] bg-gradient-to-br from-[var(--solomon-primary-from)] to-[var(--solomon-primary-to)] px-4 py-2.5 text-sm font-medium text-white"
                  >
                    Save and view results
                  </button>
                  <button
                    type="button"
                    onClick={() => oem?.onContinueAfterOemRepair?.()}
                    className={`w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                      isMobile
                        ? 'border-white/10 bg-white/[0.03] text-gray-200 hover:bg-white/[0.06]'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
                    }`}
                  >
                    Continue full diagnostic
                  </button>
                </>
              ) : null}
            </div>
          ) : needsRepair ? (
            <p className={`text-xs ${isMobile ? 'text-gray-400' : 'text-gray-500'}`}>
              Continuing with the full diagnostic — use Next for remaining wizard steps.
            </p>
          ) : null}
        </div>
      ) : (
        <OemWizardProcedureOffer
          recommendation={recommendation}
          currentStepKey="oem_test"
          wizardStepLabels={oem?.wizardStepLabels}
          onStartProcedure={oem?.onStartProcedure || (() => {})}
          variant={variant}
          inWizardStep
        />
      )}

      {!readOnly && !isActive && !isComplete ? (
        <button
          type="button"
          onClick={() => oem?.onSkipOemWizardStep?.()}
          className={`w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
            isMobile
              ? 'border-white/10 bg-white/[0.03] text-gray-300 hover:bg-white/[0.06]'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
          }`}
        >
          Skip OEM test — continue with wizard
        </button>
      ) : null}
    </div>
  );
}
