import { useMemo } from 'react';
import { listCompletedProcedureRunReviews } from '../buildProcedureRunReview';
import type { ProcedureRunState } from '../types';
import ProcedureRunReview from './ProcedureRunReview';
import {
  SOLOMON_GLASS_PANEL_CLASS,
  SOLOMON_REFERENCE_EYEBROW_CLASS,
} from '../../../solomon/solomonListPageUi';

interface DiagnosticProcedureRunsSummaryProps {
  procedureRuns?: Record<string, ProcedureRunState> | null;
  variant?: 'mobile' | 'desktop';
}

export default function DiagnosticProcedureRunsSummary({
  procedureRuns = null,
  variant = 'desktop',
}: DiagnosticProcedureRunsSummaryProps) {
  const reviews = useMemo(
    () => listCompletedProcedureRunReviews(procedureRuns),
    [procedureRuns],
  );

  if (!reviews.length) return null;

  const isMobile = variant === 'mobile';

  return (
    <section
      className={
        isMobile
          ? SOLOMON_GLASS_PANEL_CLASS
          : 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 px-4 py-3'
      }
    >
      <p className={isMobile ? SOLOMON_REFERENCE_EYEBROW_CLASS : 'text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'}>
        OEM procedure runs
      </p>
      <p
        className={
          isMobile
            ? 'mt-1 text-xs text-[var(--solomon-text-secondary)]'
            : 'mt-1 text-sm text-gray-600 dark:text-gray-300'
        }
      >
        Completed service manual tests recorded on this diagnostic.
      </p>
      <div className={`space-y-3 ${isMobile ? 'mt-3' : 'mt-4'}`}>
        {reviews.map((review) => (
          <div key={review.procedureId} className="space-y-2">
            <div>
              <p className={`font-medium ${isMobile ? 'text-sm text-[var(--solomon-text-primary)]' : 'text-sm text-gray-900 dark:text-gray-100'}`}>
                {review.procedureTitle}
              </p>
              <p className={`mt-0.5 ${isMobile ? 'text-xs text-[var(--solomon-text-secondary)]' : 'text-xs text-gray-500 dark:text-gray-400'}`}>
                {review.manualId} · TEST #{review.oemTestNumber}
              </p>
            </div>
            <ProcedureRunReview
              procedureId={review.procedureId}
              runState={procedureRuns![review.procedureId]}
              review={review}
              defaultExpanded={reviews.length === 1}
              compact
            />
          </div>
        ))}
      </div>
    </section>
  );
}
