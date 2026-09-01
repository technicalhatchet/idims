'use client';

import {
  getDiagnosticStepProgress,
  resolveDiagnosticPhaseLabel,
} from './solomonDiagnosticStepProgress';

function SegmentedBar({ stepNumber, totalSteps, progressActiveClass, compact = false }) {
  if (!totalSteps) return null;
  const inactiveClass = 'bg-[var(--solomon-border-muted)] ring-1 ring-inset ring-[color:var(--solomon-border-subtle)]';
  const activeClass = progressActiveClass || 'bg-[var(--solomon-status-diagnostic)]';

  return (
    <div className={`flex gap-[2px] ${compact ? '' : 'mt-2'}`}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div
          key={index}
          className={`flex-1 rounded-full ${compact ? 'h-1' : 'h-1.5'} ${
            index < stepNumber ? activeClass : inactiveClass
          }`}
        />
      ))}
    </div>
  );
}

export default function SolomonDiagnosticProgress({
  diagnostic,
  progressActiveClass,
  showPhaseLabel = true,
  compact = false,
  className = '',
}) {
  const progress = getDiagnosticStepProgress(diagnostic);
  if (!progress?.totalSteps) return null;

  const phaseLabel = showPhaseLabel
    ? resolveDiagnosticPhaseLabel(progress.stepNumber, progress.totalSteps)
    : null;

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2">
        <p className={`font-medium uppercase tracking-[0.08em] text-[var(--solomon-status-diagnostic)] ${
          compact ? 'text-[10px]' : 'text-[11px]'
        }`}
        >
          Step {progress.stepNumber} of {progress.totalSteps}
        </p>
        {phaseLabel ? (
          <p className={`text-[var(--solomon-text-muted)] ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
            {phaseLabel}
          </p>
        ) : null}
      </div>
      <SegmentedBar
        stepNumber={progress.stepNumber}
        totalSteps={progress.totalSteps}
        progressActiveClass={progressActiveClass}
        compact={compact}
      />
    </div>
  );
}
