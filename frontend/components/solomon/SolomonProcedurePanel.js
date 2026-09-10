'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useScrollAnchorIntoView } from '../../hooks/useScrollAnchorIntoView';
import {
  formatServiceModeRequirements,
} from '../diagnostics/procedures/recommendServiceProcedures';
import { useProcedureRun } from '../diagnostics/procedures/useProcedureRun';
import ProcedureStepView from '../diagnostics/procedures/ui/ProcedureStepView';
import ProcedureRunReview from '../diagnostics/procedures/ui/ProcedureRunReview';
import ServiceModeQuickReferenceAccordion from '../diagnostics/procedures/ui/ServiceModeQuickReferenceAccordion';
import OemSpecsLoadedBanner from './OemSpecsLoadedBanner';
import {
  SOLOMON_GLASS_PANEL_CLASS,
  SOLOMON_REFERENCE_EYEBROW_CLASS,
} from './solomonListPageUi';

function ProcedureRunCard({
  recommendation,
  savedRunState,
  isExpanded,
  onToggle,
  onRunStateChange,
  variant,
  showReason = true,
}) {
  const { procedure, reason } = recommendation;
  const serviceModeBadges = useMemo(
    () => formatServiceModeRequirements(procedure),
    [procedure],
  );

  const handleRunStateChange = useCallback(
    (nextRunState) => {
      onRunStateChange(procedure.id, nextRunState);
    },
    [onRunStateChange, procedure.id],
  );

  const {
    runState,
    currentStep,
    lastResult,
    measurementDraft,
    setMeasurementDraft,
    stepIndex,
    stepTotal,
    isRunning,
    isComplete,
    start,
    reset,
    continueStep,
    submitCheckpoint,
    submitMeasurement,
  } = useProcedureRun(procedure.id, {
    initialRunState: savedRunState,
    onRunStateChange: handleRunStateChange,
  });

  const statusLabel = isComplete
    ? 'Complete'
    : isRunning
      ? `Step ${stepIndex} of ${stepTotal}`
      : savedRunState
        ? 'Paused'
        : 'Not started';

  const procedureScrollKey = isExpanded
    ? isRunning && currentStep
      ? `${procedure.id}:${currentStep.id}`
      : procedure.id
    : null;
  const procedureAnchorRef = useScrollAnchorIntoView(procedureScrollKey, {
    enabled: isExpanded,
    delayMs: 140,
  });

  return (
    <div
      ref={procedureAnchorRef}
      className="scroll-mt-3 rounded-[var(--solomon-radius-card)] border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/60 overflow-hidden"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-[var(--solomon-surface-elevated)]/60"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--solomon-text-primary)]">{procedure.title}</p>
          {showReason && reason ? (
            <p className="mt-1 text-xs leading-relaxed text-[var(--solomon-text-secondary)]">{reason}</p>
          ) : null}
          {serviceModeBadges.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {serviceModeBadges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200"
                >
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full border border-[color:var(--solomon-border-subtle)] px-2 py-0.5 text-[10px] text-[var(--solomon-text-muted)]">
          {statusLabel}
        </span>
      </button>

      {isExpanded ? (
        <div className="border-t border-[color:var(--solomon-border-subtle)] px-3 py-3 space-y-3">
          {!isRunning && !isComplete ? (
            <button
              type="button"
              onClick={start}
              className="w-full rounded-lg border border-[color:var(--solomon-primary-border)] bg-gradient-to-br from-[var(--solomon-primary-from)] to-[var(--solomon-primary-to)] px-4 py-2.5 text-sm font-medium text-white"
            >
              {savedRunState ? 'Resume procedure' : 'Start OEM procedure'}
            </button>
          ) : (
            <button
              type="button"
              onClick={reset}
              className="w-full rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] px-4 py-2 text-sm font-medium text-[var(--solomon-text-primary)]"
            >
              Reset procedure
            </button>
          )}

          {isRunning && currentStep ? (
            <ProcedureStepView
              step={currentStep}
              stepIndex={stepIndex}
              stepTotal={stepTotal}
              measurementDraft={measurementDraft}
              onMeasurementDraftChange={setMeasurementDraft}
              onCheckpoint={submitCheckpoint}
              onSubmitMeasurement={submitMeasurement}
              onContinue={continueStep}
              lastEvaluation={lastResult?.evaluation}
              matchedBranch={lastResult?.matchedBranch}
            />
          ) : null}

          {isComplete && runState ? (
            <ProcedureRunReview
              procedureId={procedure.id}
              runState={runState}
              compact
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Full manual catalog — bottom of guided flow, closed by default (tech browse). */
export function SolomonOemCatalogAccordion({
  recommendations = [],
  catalog = [],
  procedureRuns = {},
  activeProcedureId = null,
  onProcedureRunChange,
  onActiveProcedureChange,
  platformId = null,
  variant = 'mobile',
  density = 'default',
  className = '',
}) {
  const recommendedIds = useMemo(
    () => new Set(recommendations.map((item) => item.procedureId)),
    [recommendations],
  );
  const catalogOnly = useMemo(
    () => catalog.filter((item) => !recommendedIds.has(item.procedureId)),
    [catalog, recommendedIds],
  );

  const [catalogOpen, setCatalogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(activeProcedureId || null);
  const isCompact = density === 'compact';

  const handleToggle = useCallback(
    (procedureId) => {
      setExpandedId((current) => {
        const next = current === procedureId ? null : procedureId;
        onActiveProcedureChange?.(next);
        return next;
      });
    },
    [onActiveProcedureChange],
  );

  const handleRunStateChange = useCallback(
    (procedureId, nextRunState) => {
      onProcedureRunChange?.(procedureId, nextRunState);
      if (nextRunState?.status === 'in_progress') {
        onActiveProcedureChange?.(procedureId);
      }
    },
    [onActiveProcedureChange, onProcedureRunChange],
  );

  if (!catalogOnly.length && !platformId) return null;

  return (
    <section className={`${SOLOMON_GLASS_PANEL_CLASS} ${className}`}>
      <ServiceModeQuickReferenceAccordion
        platformId={platformId}
        density={density}
        className={catalogOnly.length ? (isCompact ? 'mb-2' : 'mb-2.5') : ''}
      />

      {!catalogOnly.length ? null : (
        <>
          <button
            type="button"
            onClick={() => setCatalogOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/50 px-3 py-2.5 text-left hover:bg-[var(--solomon-surface-elevated)]/60"
            aria-expanded={catalogOpen}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--solomon-text-primary)]">
                All OEM tests
              </p>
              <p className="mt-0.5 text-xs text-[var(--solomon-text-secondary)]">
                Browse manual tests
              </p>
            </div>
            <span className="shrink-0 text-xs text-[var(--solomon-text-muted)]">
              {catalogOpen ? 'Hide' : 'Show'}
            </span>
          </button>

          {catalogOpen ? (
            <div className={`space-y-2 ${isCompact ? 'mt-2' : 'mt-2.5'}`}>
              {catalogOnly.map((entry) => (
                <ProcedureRunCard
                  key={entry.procedureId}
                  recommendation={entry}
                  savedRunState={procedureRuns[entry.procedureId] || null}
                  isExpanded={expandedId === entry.procedureId}
                  onToggle={() => handleToggle(entry.procedureId)}
                  onRunStateChange={handleRunStateChange}
                  variant={variant}
                  showReason={false}
                />
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

export default function SolomonProcedurePanel({
  recommendations = [],
  catalog = [],
  procedureRuns = {},
  activeProcedureId = null,
  onProcedureRunChange,
  onActiveProcedureChange,
  platformId = null,
  variant = 'mobile',
  density = 'default',
  platformBanner = null,
  showCatalog = true,
  catalogPlacement = 'none',
  bannerOnly = false,
}) {
  const recommendedIds = useMemo(
    () => new Set(recommendations.map((item) => item.procedureId)),
    [recommendations],
  );
  const catalogOnly = useMemo(
    () => catalog.filter((item) => !recommendedIds.has(item.procedureId)),
    [catalog, recommendedIds],
  );

  const [expandedId, setExpandedId] = useState(activeProcedureId || recommendations[0]?.procedureId || null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const isCompact = density === 'compact';
  const showInlineCatalog = showCatalog && catalogPlacement === 'inline';

  const topRecommendation = recommendations[0];
  const topLeadId = topRecommendation?.procedureId || null;
  const topLeadIsStrong =
    Boolean(topRecommendation?.matchedErrorCodes?.length)
    || (topRecommendation?.priority ?? 0) >= 35;

  useEffect(() => {
    if (!topLeadId || !topLeadIsStrong) return;
    if (activeProcedureId) return;
    setExpandedId((current) => current || topLeadId);
  }, [topLeadId, topLeadIsStrong, activeProcedureId]);

  const handleToggle = useCallback(
    (procedureId) => {
      setExpandedId((current) => {
        const next = current === procedureId ? null : procedureId;
        onActiveProcedureChange?.(next);
        return next;
      });
    },
    [onActiveProcedureChange],
  );

  const handleRunStateChange = useCallback(
    (procedureId, nextRunState) => {
      onProcedureRunChange?.(procedureId, nextRunState);
      if (nextRunState?.status === 'in_progress') {
        onActiveProcedureChange?.(procedureId);
      }
    },
    [onActiveProcedureChange, onProcedureRunChange],
  );

  if (!platformBanner && !recommendations.length && !catalog.length) return null;

  if (bannerOnly) {
    return (
      <OemSpecsLoadedBanner
        platformLabel={platformBanner?.platformLabel}
        equipmentMake={platformBanner?.equipmentMake}
        equipmentModel={platformBanner?.equipmentModel}
        compact={isCompact}
      />
    );
  }

  const hasRunnerContent = recommendations.length > 0 || (showInlineCatalog && catalogOnly.length > 0);
  if (!hasRunnerContent && platformBanner) {
    return (
      <OemSpecsLoadedBanner
        platformLabel={platformBanner.platformLabel}
        equipmentMake={platformBanner.equipmentMake}
        equipmentModel={platformBanner.equipmentModel}
        compact={isCompact}
      />
    );
  }

  return (
    <section className={`${SOLOMON_GLASS_PANEL_CLASS} scroll-mt-3`} data-oem-procedure-panel>
      {platformBanner ? (
        <OemSpecsLoadedBanner
          platformLabel={platformBanner.platformLabel}
          equipmentMake={platformBanner.equipmentMake}
          equipmentModel={platformBanner.equipmentModel}
          compact={isCompact}
          className={isCompact ? 'mb-2' : 'mb-3'}
        />
      ) : null}

      {recommendations.length ? (
        <>
          <p className={SOLOMON_REFERENCE_EYEBROW_CLASS}>Recommended OEM test</p>
          <div className={`space-y-2 ${isCompact ? 'mt-2' : 'mt-3'}`}>
            {recommendations.map((recommendation) => (
              <ProcedureRunCard
                key={recommendation.procedureId}
                recommendation={recommendation}
                savedRunState={procedureRuns[recommendation.procedureId] || null}
                isExpanded={expandedId === recommendation.procedureId}
                onToggle={() => handleToggle(recommendation.procedureId)}
                onRunStateChange={handleRunStateChange}
                variant={variant}
              />
            ))}
          </div>
        </>
      ) : null}

      {showInlineCatalog && (catalogOnly.length || platformId) ? (
        <div className={recommendations.length ? (isCompact ? 'mt-3' : 'mt-4') : (isCompact ? 'mt-2' : 'mt-3')}>
          <ServiceModeQuickReferenceAccordion
            platformId={platformId || platformBanner?.platformId || null}
            density={density}
            className={catalogOnly.length ? (isCompact ? 'mb-2' : 'mb-2.5') : ''}
          />

          {!catalogOnly.length ? null : (
            <>
              <button
                type="button"
                onClick={() => setCatalogOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/50 px-3 py-2.5 text-left hover:bg-[var(--solomon-surface-elevated)]/60"
                aria-expanded={catalogOpen}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--solomon-text-primary)]">
                    All OEM tests
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--solomon-text-secondary)]">
                    Browse manual tests
                  </p>
                </div>
                <span className="shrink-0 text-xs text-[var(--solomon-text-muted)]">
                  {catalogOpen ? 'Hide' : 'Show'}
                </span>
              </button>

              {catalogOpen ? (
                <div className={`space-y-2 ${isCompact ? 'mt-2' : 'mt-2.5'}`}>
                  {catalogOnly.map((entry) => (
                    <ProcedureRunCard
                      key={entry.procedureId}
                      recommendation={entry}
                      savedRunState={procedureRuns[entry.procedureId] || null}
                      isExpanded={expandedId === entry.procedureId}
                      onToggle={() => handleToggle(entry.procedureId)}
                      onRunStateChange={handleRunStateChange}
                      variant={variant}
                      showReason={false}
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
