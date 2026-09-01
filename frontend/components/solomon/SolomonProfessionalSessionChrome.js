'use client';

import SolomonSessionHeader from './SolomonSessionHeader';
import SolomonDiagnosticProgress from './SolomonDiagnosticProgress';
import SolomonConfidenceBadge from './SolomonConfidenceBadge';
import SolomonDataPointsPanel from './SolomonDataPointsPanel';

/**
 * Professional in-session chrome — header, progress, confidence, data points.
 */
export default function SolomonProfessionalSessionChrome({
  session,
  payload,
  intelligence,
  measurementStatuses,
  onStepSelect,
  className = '',
  sticky = true,
}) {
  if (!payload?.templateId) return null;

  const diagnostic = session
    ? { ...session, payload: session.payload || payload }
    : { payload };

  return (
    <div
      className={`space-y-2 ${sticky ? 'sticky top-0 z-[15] -mx-1 px-1 pb-2 bg-[var(--solomon-bg-canvas)]' : ''} ${className}`}
    >
      <SolomonSessionHeader
        diagnostic={diagnostic}
        templateId={payload.templateId}
        templateLabel={session?.template_label}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-[var(--solomon-radius-card)] border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] px-2.5 py-2">
          <SolomonDiagnosticProgress diagnostic={diagnostic} compact showPhaseLabel />
        </div>
        <SolomonConfidenceBadge intelligence={intelligence} compact />
      </div>

      <SolomonDataPointsPanel
        templateId={payload.templateId}
        fields={payload.fields || {}}
        measurementStatuses={measurementStatuses}
        visitedStepKeys={payload.visitedStepKeys || []}
        onStepSelect={onStepSelect}
        defaultExpanded={false}
      />
    </div>
  );
}
