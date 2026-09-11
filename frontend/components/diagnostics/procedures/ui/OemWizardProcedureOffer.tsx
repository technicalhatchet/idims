'use client';

import type { ProcedureRecommendation } from '../recommendServiceProcedures';
import {
  isStrongProcedureLead,
  resolveWizardStepKeyForProcedure,
  resolveWizardStepLabelForProcedure,
} from '../procedureWizardLead';

interface OemWizardProcedureOfferProps {
  recommendation: ProcedureRecommendation | null | undefined;
  currentStepKey?: string | null | undefined;
  wizardStepLabels?: Record<string, string>;
  onStartProcedure: (procedureId: string) => void;
  variant?: 'mobile' | 'desktop';
  /** When true, hide cross-step hints — this is the dedicated OEM wizard step. */
  inWizardStep?: boolean;
}

/**
 * Compact OEM suggestion + launch for the dedicated OEM wizard step.
 */
export default function OemWizardProcedureOffer({
  recommendation,
  currentStepKey,
  wizardStepLabels,
  onStartProcedure,
  variant = 'desktop',
  inWizardStep = false,
}: OemWizardProcedureOfferProps) {
  if (!recommendation || !isStrongProcedureLead(recommendation)) return null;

  const procedureStepKey = resolveWizardStepKeyForProcedure(recommendation.procedure);
  const procedureStepLabel = procedureStepKey
    ? resolveWizardStepLabelForProcedure(recommendation.procedure, wizardStepLabels)
    : null;
  const onIdealStep = inWizardStep || Boolean(procedureStepKey && procedureStepKey === currentStepKey);
  const isMobile = variant === 'mobile';

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        isMobile
          ? 'border-cyan-500/30 bg-cyan-500/10'
          : 'border-cyan-200 bg-cyan-50/80 dark:border-cyan-800 dark:bg-cyan-950/40'
      }`}
      data-oem-wizard-offer
    >
      <p
        className={`text-[10px] font-semibold uppercase tracking-wide ${
          isMobile ? 'text-cyan-200/80' : 'text-cyan-700 dark:text-cyan-300/80'
        }`}
      >
        Suggested OEM test
      </p>
      <p
        className={`mt-1 text-sm font-medium ${
          isMobile ? 'text-cyan-50' : 'text-cyan-950 dark:text-cyan-50'
        }`}
      >
        {recommendation.procedure.title}
      </p>
      {recommendation.reason ? (
        <p
          className={`mt-1 text-xs leading-relaxed ${
            isMobile ? 'text-cyan-100/80' : 'text-cyan-900/80 dark:text-cyan-100/80'
          }`}
        >
          {recommendation.reason}
        </p>
      ) : null}
      {!onIdealStep && procedureStepLabel ? (
        <p
          className={`mt-1 text-[11px] ${
            isMobile ? 'text-cyan-100/70' : 'text-cyan-800/70 dark:text-cyan-200/70'
          }`}
        >
          Also covered on the <span className="font-medium">{procedureStepLabel}</span> wizard step.
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => onStartProcedure(recommendation.procedureId)}
        className={`mt-2 w-full rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
          isMobile
            ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-50 hover:bg-cyan-500/25'
            : 'border-cyan-300 bg-white text-cyan-900 hover:bg-cyan-100 dark:border-cyan-700 dark:bg-cyan-950 dark:text-cyan-50 dark:hover:bg-cyan-900/60'
        }`}
      >
        Start OEM test
      </button>
    </div>
  );
}
