'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  formatServiceModeRequirements,
} from '../diagnostics/procedures/recommendServiceProcedures';
import { useProcedureRun } from '../diagnostics/procedures/useProcedureRun';
import { buildProcedureStepPresentationContext } from '../diagnostics/procedures/procedureStepPresentation';
import ProcedureStepView from '../diagnostics/procedures/ui/ProcedureStepView';
import ProcedureRunReview from '../diagnostics/procedures/ui/ProcedureRunReview';
import ServiceModeQuickReferenceAccordion from '../diagnostics/procedures/ui/ServiceModeQuickReferenceAccordion';
import OemSpecsLoadedBanner from './OemSpecsLoadedBanner';
import OemCatalogBrowseSections, { OemCatalogBrowseToggle } from './OemCatalogBrowseSections';
import { partitionOemCatalogEntries } from '../diagnostics/procedures/oemWizardDecisions';
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
  intelligence = null,
  templateId = null,
  presentationAudience = 'tech',
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
    submitOpenCircuitMeasurement,
  } = useProcedureRun(procedure.id, {
    initialRunState: savedRunState,
    onRunStateChange: handleRunStateChange,
  });

  const presentationContext = useMemo(
    () => buildProcedureStepPresentationContext(recommendation, {
      intelligence,
      templateId,
    }),
    [recommendation, intelligence, templateId],
  );

  const statusLabel = isComplete
    ? 'Complete'
    : isRunning
      ? (stepIndex > 0 ? `Step ${stepIndex}` : 'In progress')
      : savedRunState
        ? 'Paused'
        : 'Not started';

  return (
    <div
      className="rounded-[var(--solomon-radius-card)] border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/60 overflow-hidden"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-[var(--solomon-surface-elevated)]/60"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-[var(--solomon-text-muted)]">
            OEM diagnostic procedure
          </p>
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
          {recommendation.canonicalDomainMatches?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {recommendation.canonicalDomainMatches.map((domainId) => (
                <span
                  key={domainId}
                  className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-100"
                >
                  {domainId.replace(/_failure$/, '').replace(/_/g, ' ')}
                </span>
              ))}
              {recommendation.canonicalBoost ? (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                  +{recommendation.canonicalBoost} canonical
                </span>
              ) : null}
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
              procedureId={procedure.id}
              step={currentStep}
              stepIndex={stepIndex}
              stepTotal={stepTotal}
              measurementDraft={measurementDraft}
              onMeasurementDraftChange={setMeasurementDraft}
              onCheckpoint={submitCheckpoint}
              onSubmitMeasurement={submitMeasurement}
              onSubmitOpenCircuitMeasurement={submitOpenCircuitMeasurement}
              onContinue={continueStep}
              lastEvaluation={
                lastResult?.stepId === currentStep?.id ? lastResult?.evaluation : null
              }
              matchedBranch={
                lastResult?.stepId === currentStep?.id ? lastResult?.matchedBranch : null
              }
              variant={variant}
              presentationAudience={presentationAudience}
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
  intelligence = null,
  templateId = null,
  oemWizardLeadDecisions,
}) {
  const recommendedIds = useMemo(
    () => new Set(recommendations.map((item) => item.procedureId)),
    [recommendations],
  );
  const catalogOnly = useMemo(
    () => catalog.filter((item) => !recommendedIds.has(item.procedureId)),
    [catalog, recommendedIds],
  );
  const availableCatalogOnly = useMemo(() => {
    const partitioned = partitionOemCatalogEntries(
      catalogOnly,
      procedureRuns,
      oemWizardLeadDecisions,
    );
    return partitioned.available;
  }, [catalogOnly, procedureRuns, oemWizardLeadDecisions]);

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

  const hasCatalogBrowse = catalog.length > 0 || Boolean(platformId);
  if (!hasCatalogBrowse) return null;

  const renderCatalogEntry = (entry) => (
    <ProcedureRunCard
      key={entry.procedureId}
      recommendation={entry}
      savedRunState={procedureRuns[entry.procedureId] || null}
      isExpanded={expandedId === entry.procedureId}
      onToggle={() => handleToggle(entry.procedureId)}
      onRunStateChange={handleRunStateChange}
      variant={variant}
      showReason={false}
      intelligence={intelligence}
      templateId={templateId}
    />
  );

  return (
    <section className={`${SOLOMON_GLASS_PANEL_CLASS} ${className}`}>
      <ServiceModeQuickReferenceAccordion
        platformId={platformId}
        density={density}
        className={catalog.length ? (isCompact ? 'mb-2' : 'mb-2.5') : ''}
      />

      {!catalog.length ? null : (
        <>
          <OemCatalogBrowseToggle
            catalogOpen={catalogOpen}
            onToggle={() => setCatalogOpen((current) => !current)}
            availableCount={availableCatalogOnly.length}
          />

          {catalogOpen ? (
            <OemCatalogBrowseSections
              catalogEntries={catalog}
              catalogOnlyAvailable={catalogOnly}
              procedureRuns={procedureRuns}
              oemWizardLeadDecisions={oemWizardLeadDecisions}
              renderEntry={renderCatalogEntry}
              isCompact={isCompact}
            />
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
  hideRecommendations = false,
  intelligence = null,
  templateId = null,
  presentationAudience = 'tech',
  oemWizardLeadDecisions,
}) {
  const recommendedIds = useMemo(
    () => new Set(recommendations.map((item) => item.procedureId)),
    [recommendations],
  );
  const catalogOnly = useMemo(
    () => catalog.filter((item) => !recommendedIds.has(item.procedureId)),
    [catalog, recommendedIds],
  );
  const availableCatalogOnly = useMemo(() => {
    const partitioned = partitionOemCatalogEntries(
      catalogOnly,
      procedureRuns,
      oemWizardLeadDecisions,
    );
    return partitioned.available;
  }, [catalogOnly, procedureRuns, oemWizardLeadDecisions]);

  const [expandedId, setExpandedId] = useState(activeProcedureId || recommendations[0]?.procedureId || null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const isCompact = density === 'compact';
  const showInlineCatalog = showCatalog && catalogPlacement === 'inline';

  useEffect(() => {
    if (activeProcedureId) {
      setExpandedId(activeProcedureId);
    }
  }, [activeProcedureId]);

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
        canonicalDomainLabels={platformBanner?.canonicalDomainLabels || []}
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
        canonicalDomainLabels={platformBanner.canonicalDomainLabels || []}
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
          canonicalDomainLabels={platformBanner.canonicalDomainLabels || []}
          compact={isCompact}
          className={isCompact ? 'mb-2' : 'mb-3'}
        />
      ) : null}

      {!hideRecommendations && recommendations.length ? (
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
                intelligence={intelligence}
                templateId={templateId}
                presentationAudience={presentationAudience}
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

          {!catalog.length ? null : (
            <>
              <OemCatalogBrowseToggle
                catalogOpen={catalogOpen}
                onToggle={() => setCatalogOpen((current) => !current)}
                availableCount={availableCatalogOnly.length}
              />

              {catalogOpen ? (
                <OemCatalogBrowseSections
                  catalogEntries={catalog}
                  catalogOnlyAvailable={catalogOnly}
                  procedureRuns={procedureRuns}
                  oemWizardLeadDecisions={oemWizardLeadDecisions}
                  isCompact={isCompact}
                  renderEntry={(entry) => (
                    <ProcedureRunCard
                      key={entry.procedureId}
                      recommendation={entry}
                      savedRunState={procedureRuns[entry.procedureId] || null}
                      isExpanded={expandedId === entry.procedureId}
                      onToggle={() => handleToggle(entry.procedureId)}
                      onRunStateChange={handleRunStateChange}
                      variant={variant}
                      showReason={false}
                      intelligence={intelligence}
                      templateId={templateId}
                      presentationAudience={presentationAudience}
                    />
                  )}
                />
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
