'use client';

import type { ProcedureRecommendation } from '../recommendServiceProcedures';
import {
  isStrongProcedureLead,
  resolveWizardStepLabelForProcedure,
} from '../procedureWizardLead';

interface OemProcedureLeadCardProps {
  recommendation: ProcedureRecommendation | null | undefined;
  onOpenProcedure?: (procedureId: string) => void;
  wizardStepLabels?: Record<string, string>;
  variant?: 'mobile' | 'desktop';
  className?: string;
}

export function scrollToOemProcedurePanel() {
  const panel = document.querySelector('[data-oem-procedure-panel]');
  panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function OemProcedureLeadCard({
  recommendation,
  onOpenProcedure,
  wizardStepLabels,
  variant = 'desktop',
  className = '',
}: OemProcedureLeadCardProps) {
  if (!recommendation) return null;

  if (!isStrongProcedureLead(recommendation)) return null;

  const isMobile = variant === 'mobile';
  const wizardStepLabel = resolveWizardStepLabelForProcedure(
    recommendation.procedure,
    wizardStepLabels,
  );

  const handleOpen = () => {
    onOpenProcedure?.(recommendation.procedureId);
    scrollToOemProcedurePanel();
  };

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        isMobile
          ? 'border-cyan-500/30 bg-cyan-500/10'
          : 'border-cyan-200 bg-cyan-50/80 dark:border-cyan-800 dark:bg-cyan-950/40'
      } ${className}`}
      data-oem-procedure-lead
    >
      <p
        className={`text-[10px] font-semibold uppercase tracking-wide ${
          isMobile ? 'text-cyan-200/80' : 'text-cyan-700 dark:text-cyan-300/80'
        }`}
      >
        Recommended OEM test
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
      {wizardStepLabel ? (
        <p
          className={`mt-1 text-[11px] ${
            isMobile ? 'text-cyan-100/70' : 'text-cyan-800/70 dark:text-cyan-200/70'
          }`}
        >
          Wizard will suggest <span className="font-medium">{wizardStepLabel}</span> next.
        </p>
      ) : null}
      <button
        type="button"
        onClick={handleOpen}
        className={`mt-2 w-full rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
          isMobile
            ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-50 hover:bg-cyan-500/25'
            : 'border-cyan-300 bg-white text-cyan-900 hover:bg-cyan-100 dark:border-cyan-700 dark:bg-cyan-950 dark:text-cyan-50 dark:hover:bg-cyan-900/60'
        }`}
      >
        Open OEM procedure
      </button>
    </div>
  );
}
