/**
 * Presentation-only review workbench shell.
 * Does not change routing, page structure, index/candidate data model, API semantics,
 * or review lifecycle — same list, filters, selection, and accept/reject/defer POST.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SOLOMON_GLASS_PANEL_CLASS } from '../solomonListPageUi';
import reviewIndex from '../../diagnostics/knowledge/normalization/review/CG_PRODUCTION_NORMALIZATION_CANDIDATE_REVIEW_INDEX_v1.json';
import matcherReviewIndex from '../../diagnostics/knowledge/normalization/calibration/CG_MATCHER_IMPROVEMENT_REVIEW_v1.json';
import deltaReconciliationQueue from '../../diagnostics/knowledge/normalization/calibration/CG_MATCHER_IMPROVEMENT_DELTA_RECONCILIATION_QUEUE_v1.json';
import matcherReconciledReviewScope from '../../diagnostics/knowledge/normalization/calibration/CG_MATCHER_RECONCILED_CANDIDATE_REVIEW_v1.json';
import {
  decisionsMapFromStore,
  formatSourceTermLabel,
  mapsToCollapsedParts,
  mergeHydratedDecisions,
  pickNextCandidateIdInList,
  DELTA_RECONCILIATION_DECISIONS_API,
  MATCHER_IMPROVEMENT_DECISIONS_API,
  MATCHER_RECONCILED_CANDIDATE_REVIEW_DECISIONS_API,
  REVIEW_CLASS_LABELS,
  REVIEW_DECISIONS_API,
} from './candidateReviewWorkflow';
import DeltaReconciliationDetailPanel from './DeltaReconciliationDetailPanel';
import DeltaReconciliationGuidancePanel from './DeltaReconciliationGuidancePanel';
import MatcherReconciledCandidateDetailPanel from './MatcherReconciledCandidateDetailPanel';
import MatcherReconciledCandidateGuidancePanel from './MatcherReconciledCandidateGuidancePanel';
import CandidateReviewDetailPanel from './CandidateReviewDetailPanel';
import MatcherImprovementDetailPanel from './MatcherImprovementDetailPanel';
import MatcherImprovementReviewGuidancePanel from './MatcherImprovementReviewGuidancePanel';
import Wave1ReviewGuidancePanel from './Wave1ReviewGuidancePanel';
import Wave2ReviewGuidancePanel from './Wave2ReviewGuidancePanel';
import Wave3ReviewGuidancePanel from './Wave3ReviewGuidancePanel';
import { WAVE1_REVIEW_CLASS } from './wave1ReviewGuidance';
import { WAVE2_REVIEW_CLASS } from './wave2ReviewGuidance';
import { WAVE3_REVIEW_CLASS } from './wave3ReviewGuidance';
import {
  isNewCanonicalKnowledgeCandidate,
  isNewPlatformKnowledgeCandidate,
  wave3ListRowMapsToDetail,
  wave3ListRowMapsToHighlight,
  wave3ListRowPrimaryLabel,
} from './wave3ReviewPresentation';
import {
  wave2ListRowMapsToDetail,
  wave2ListRowMapsToHighlight,
  wave2ListRowPrimaryLabel,
} from './wave2ReviewPresentation';

const REVIEW_CLASSES = Object.keys(REVIEW_CLASS_LABELS);
const REVIEW_STATUSES = ['unreviewed', 'accepted', 'rejected', 'deferred'];

function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

function scrollCandidateListIntoView(listRef) {
  if (!listRef?.current) return;
  const isStackedLayout = typeof window !== 'undefined'
    && window.matchMedia('(max-width: 1023px)').matches;
  if (!isStackedLayout) return;
  listRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="block text-[11px] text-[var(--solomon-text-muted)]">
      <span className="mb-1 block">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-[var(--solomon-text-primary)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export default function CandidateReviewWorkbench() {
  const [manualFilter, setManualFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [blockedFilter, setBlockedFilter] = useState('all');
  const [promotionBlockedFilter, setPromotionBlockedFilter] = useState('all');
  const [workbenchView, setWorkbenchView] = useState('candidates');
  const [selectedId, setSelectedId] = useState(null);
  const [decisionState, setDecisionState] = useState({});
  const [matcherDecisionState, setMatcherDecisionState] = useState({});
  const [deltaDecisionState, setDeltaDecisionState] = useState({});
  const [matcherReconciledDecisionState, setMatcherReconciledDecisionState] = useState({});
  const [decisionsLoading, setDecisionsLoading] = useState(true);
  const [matcherDecisionsLoading, setMatcherDecisionsLoading] = useState(true);
  const [deltaDecisionsLoading, setDeltaDecisionsLoading] = useState(true);
  const [matcherReconciledDecisionsLoading, setMatcherReconciledDecisionsLoading] = useState(true);
  const [decisionsLoadError, setDecisionsLoadError] = useState(null);
  const [matcherDecisionsLoadError, setMatcherDecisionsLoadError] = useState(null);
  const [deltaDecisionsLoadError, setDeltaDecisionsLoadError] = useState(null);
  const [matcherReconciledDecisionsLoadError, setMatcherReconciledDecisionsLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const detailPanelRef = useRef(null);
  const candidateListRef = useRef(null);

  const baseRecords = reviewIndex.candidateRecords || [];
  const reconciliations = reviewIndex.manualReconciliations || [];

  useEffect(() => {
    let cancelled = false;

    async function hydrateDecisions() {
      setDecisionsLoading(true);
      setDecisionsLoadError(null);
      try {
        const response = await fetch(REVIEW_DECISIONS_API);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load review decisions');
        }
        if (cancelled) return;
        setDecisionState(decisionsMapFromStore(payload));
      } catch (err) {
        if (!cancelled) {
          setDecisionsLoadError(err.message || 'Failed to load review decisions');
        }
      } finally {
        if (!cancelled) {
          setDecisionsLoading(false);
        }
      }
    }

    async function hydrateMatcherDecisions() {
      setMatcherDecisionsLoading(true);
      setMatcherDecisionsLoadError(null);
      try {
        const response = await fetch(MATCHER_IMPROVEMENT_DECISIONS_API);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load matcher improvement decisions');
        }
        if (cancelled) return;
        const map = {};
        Object.values(payload.decisions || {}).forEach((entry) => {
          if (entry?.backlogId && entry?.reviewStatus) {
            map[entry.backlogId] = entry.reviewStatus;
          }
        });
        setMatcherDecisionState(map);
      } catch (err) {
        if (!cancelled) {
          setMatcherDecisionsLoadError(err.message || 'Failed to load matcher improvement decisions');
        }
      } finally {
        if (!cancelled) {
          setMatcherDecisionsLoading(false);
        }
      }
    }

    async function hydrateDeltaDecisions() {
      setDeltaDecisionsLoading(true);
      setDeltaDecisionsLoadError(null);
      try {
        const response = await fetch(DELTA_RECONCILIATION_DECISIONS_API);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load delta reconciliation decisions');
        }
        if (cancelled) return;
        const map = {};
        Object.values(payload.decisions || {}).forEach((entry) => {
          if (entry?.decisionId && entry?.decision) {
            map[entry.decisionId] = entry.decision;
          }
        });
        setDeltaDecisionState(map);
      } catch (err) {
        if (!cancelled) {
          setDeltaDecisionsLoadError(err.message || 'Failed to load delta reconciliation decisions');
        }
      } finally {
        if (!cancelled) {
          setDeltaDecisionsLoading(false);
        }
      }
    }

    async function hydrateMatcherReconciledDecisions() {
      setMatcherReconciledDecisionsLoading(true);
      setMatcherReconciledDecisionsLoadError(null);
      try {
        const response = await fetch(MATCHER_RECONCILED_CANDIDATE_REVIEW_DECISIONS_API);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load matcher-reconciled review decisions');
        }
        if (cancelled) return;
        const map = {};
        Object.values(payload.decisions || {}).forEach((entry) => {
          if (entry?.decisionId && entry?.decision) {
            map[entry.decisionId] = entry.decision;
          }
        });
        setMatcherReconciledDecisionState(map);
      } catch (err) {
        if (!cancelled) {
          setMatcherReconciledDecisionsLoadError(err.message || 'Failed to load matcher-reconciled decisions');
        }
      } finally {
        if (!cancelled) {
          setMatcherReconciledDecisionsLoading(false);
        }
      }
    }

    hydrateDecisions();
    hydrateMatcherDecisions();
    hydrateDeltaDecisions();
    hydrateMatcherReconciledDecisions();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId || !detailPanelRef.current) return;
    detailPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedId]);

  const matcherItems = useMemo(
    () => (matcherReviewIndex.reviewItems || []).map((item) => ({
      ...item,
      candidateId: item.backlogId,
      reviewStatus: matcherDecisionState[item.backlogId] || 'unreviewed',
    })),
    [matcherDecisionState],
  );

  const deltaPopulationAItems = useMemo(
    () => (deltaReconciliationQueue.populationA || []).map((item) => ({
      ...item,
      candidateId: item.decisionId,
      reviewStatus: deltaDecisionState[item.decisionId] || 'unreviewed',
    })),
    [deltaDecisionState],
  );

  const deltaPopulationBItems = useMemo(
    () => (deltaReconciliationQueue.populationB || []).map((item) => ({
      ...item,
      candidateId: item.decisionId,
      reviewStatus: deltaDecisionState[item.decisionId] || 'unreviewed',
    })),
    [deltaDecisionState],
  );

  const matcherReconciledItems = useMemo(
    () => (matcherReconciledReviewScope.scopeRecords || []).map((item) => ({
      ...item,
      candidateId: item.decisionId,
      reviewStatus: matcherReconciledDecisionState[item.decisionId] || 'unreviewed',
    })),
    [matcherReconciledDecisionState],
  );

  const records = useMemo(
    () => mergeHydratedDecisions(baseRecords, { decisions: Object.fromEntries(
      Object.entries(decisionState).map(([candidateId, reviewStatus]) => [
        candidateId,
        { candidateId, reviewStatus },
      ]),
    ) }),
    [baseRecords, decisionState],
  );

  const activeRecords = workbenchView === 'matcherImprovement'
    ? matcherItems
    : workbenchView === 'deltaReconciliationA'
      ? deltaPopulationAItems
      : workbenchView === 'deltaReconciliationB'
        ? deltaPopulationBItems
        : workbenchView === 'matcherReconciled'
          ? matcherReconciledItems
          : records;

  const deltaPopulation = workbenchView === 'deltaReconciliationA'
    ? 'A'
    : workbenchView === 'deltaReconciliationB'
      ? 'B'
      : null;
  const isMatcherReconciled = workbenchView === 'matcherReconciled';

  const manualOptions = useMemo(() => {
    const manuals = [...new Set(activeRecords.map((record) => record.manualId).filter(Boolean))].sort();
    return [{ value: 'all', label: 'All manuals' }, ...manuals.map((manual) => ({ value: manual, label: manual }))];
  }, [activeRecords]);

  const typeOptions = useMemo(() => {
    const types = [...new Set(activeRecords.map((record) => record.mapsTo?.candidateType).filter(Boolean))].sort();
    return [{ value: 'all', label: 'All types' }, ...types.map((type) => ({ value: type, label: type }))];
  }, [activeRecords]);

  const filtered = useMemo(() => activeRecords.filter((record) => {
    if (workbenchView === 'matcherImprovement' || deltaPopulation || isMatcherReconciled) {
      const status = record.reviewStatus || 'unreviewed';
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      return true;
    }
    if (manualFilter !== 'all' && record.manualId !== manualFilter) return false;
    if (classFilter !== 'all' && record.reviewClass !== classFilter) return false;
    if (typeFilter !== 'all' && record.mapsTo?.candidateType !== typeFilter) return false;
    const status = record.reviewStatus || 'unreviewed';
    if (statusFilter !== 'all' && status !== statusFilter) return false;
    if (blockedFilter === 'blocked' && !record.blockers?.blockedReason) return false;
    if (blockedFilter === 'unblocked' && record.blockers?.blockedReason) return false;
    if (promotionBlockedFilter === 'true' && !record.blockers?.promotionBlocked) return false;
    if (promotionBlockedFilter === 'false' && record.blockers?.promotionBlocked) return false;
    return true;
  }), [
    activeRecords,
    workbenchView,
    isMatcherReconciled,
    manualFilter,
    classFilter,
    typeFilter,
    statusFilter,
    blockedFilter,
    promotionBlockedFilter,
  ]);

  const selected = filtered.find((record) => record.candidateId === selectedId)
    || activeRecords.find((record) => record.candidateId === selectedId)
    || null;

  const submitDecision = useCallback(async (reviewStatus) => {
    if (!selected) return;
    const decidedId = selected.candidateId;
    const nextId = pickNextCandidateIdInList(filtered, decidedId);
    setSaving(true);
    setError(null);
    try {
      const isMatcher = workbenchView === 'matcherImprovement';
      const isDelta = Boolean(deltaPopulation);
      const isMatcherReconciledView = workbenchView === 'matcherReconciled';
      const response = await fetch(
        isMatcherReconciledView
          ? MATCHER_RECONCILED_CANDIDATE_REVIEW_DECISIONS_API
          : isDelta
            ? DELTA_RECONCILIATION_DECISIONS_API
            : isMatcher
              ? MATCHER_IMPROVEMENT_DECISIONS_API
              : REVIEW_DECISIONS_API,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isMatcherReconciledView
              ? {
                decisionId: selected.decisionId,
                decision: reviewStatus,
              }
              : isDelta
              ? {
                decisionId: selected.decisionId,
                population: deltaPopulation,
                decision: reviewStatus,
                candidateKey: selected.candidateKey,
                baselineClassification: selected.baselineClassification,
                stagedClassification: selected.stagedClassification,
                baselineTarget: selected.baselineProposedCanonicalId,
                stagedTarget: selected.stagedProposedCanonicalId,
              }
              : isMatcher
                ? {
                  backlogId: selected.backlogId,
                  reviewStatus,
                  batchRunId: matcherReviewIndex.batchRunId,
                }
                : {
                  candidateId: decidedId,
                  reviewStatus,
                  manualId: selected.manualId,
                  batchRunId: reviewIndex.batchRunId,
                },
          ),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save review decision');
      }
      if (isMatcherReconciledView) {
        setMatcherReconciledDecisionState((current) => ({
          ...current,
          [selected.decisionId]: reviewStatus,
        }));
      } else if (isDelta) {
        setDeltaDecisionState((current) => ({
          ...current,
          [selected.decisionId]: reviewStatus,
        }));
      } else if (isMatcher) {
        setMatcherDecisionState((current) => ({
          ...current,
          [selected.backlogId]: reviewStatus,
        }));
      } else {
        setDecisionState((current) => ({
          ...current,
          [decidedId]: reviewStatus,
        }));
      }
      if (nextId) {
        setSelectedId(nextId);
      }
      requestAnimationFrame(() => {
        scrollCandidateListIntoView(candidateListRef);
      });
    } catch (err) {
      setError(err.message || 'Failed to save review decision');
    } finally {
      setSaving(false);
    }
  }, [filtered, selected, workbenchView, deltaPopulation]);

  const selectedStatus = selected?.reviewStatus || 'unreviewed';

  const selectedReconciliation = selected
    ? reconciliations.find((entry) => entry.manualId === selected.manualId)
    : null;

  return (
    <div className="space-y-4">
      <div className={`${SOLOMON_GLASS_PANEL_CLASS} border-amber-500/30 bg-amber-500/5 p-3`}>
        <p className="text-xs text-amber-100/90">
          Review-only workbench. Accept / reject / defer records a human review decision only.
          It does <strong>not</strong> promote canonical knowledge.
        </p>
        <p className="mt-1 text-[11px] text-[var(--solomon-text-muted)]">
          Batch {reviewIndex.batchRunId} · {reviewIndex.totalCandidateRecords} candidates indexed
          {decisionsLoading ? ' · loading review decisions…' : ''}
          {decisionsLoadError ? ` · ${decisionsLoadError}` : ''}
          {matcherDecisionsLoadError ? ` · ${matcherDecisionsLoadError}` : ''}
          {deltaDecisionsLoadError ? ` · ${deltaDecisionsLoadError}` : ''}
          {matcherReconciledDecisionsLoadError ? ` · ${matcherReconciledDecisionsLoadError}` : ''}
        </p>
        <label className="mt-2 block text-[11px] text-[var(--solomon-text-muted)]">
          <span className="mb-1 block">Review queue</span>
          <select
            value={workbenchView}
            onChange={(event) => {
              setWorkbenchView(event.target.value);
              setSelectedId(null);
              setError(null);
            }}
            className="w-full max-w-md rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-[var(--solomon-text-primary)]"
            data-testid="review-workbench-view-select"
          >
            <option value="candidates">Production normalization candidates</option>
            <option value="matcherImprovement">Matcher improvement gate (17)</option>
            <option value="deltaReconciliationA">Delta reconciliation — Population A (46)</option>
            <option value="deltaReconciliationB">Delta reconciliation — Population B (drift)</option>
            <option value="matcherReconciled">Matcher-reconciled candidates (52)</option>
          </select>
        </label>
      </div>

      <div className={`${SOLOMON_GLASS_PANEL_CLASS} grid gap-3 p-3 md:grid-cols-3 lg:grid-cols-6 ${workbenchView === 'matcherImprovement' || deltaPopulation || isMatcherReconciled ? 'hidden' : ''}`}>
        <FilterSelect label="Manual" value={manualFilter} onChange={setManualFilter} options={manualOptions} />
        <FilterSelect
          label="Review class"
          value={classFilter}
          onChange={setClassFilter}
          options={[
            { value: 'all', label: 'All classes' },
            ...REVIEW_CLASSES.map((value) => ({ value, label: REVIEW_CLASS_LABELS[value] || value })),
          ]}
        />
        <FilterSelect label="Candidate type" value={typeFilter} onChange={setTypeFilter} options={typeOptions} />
        <FilterSelect
          label="Review status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All statuses' },
            ...REVIEW_STATUSES.map((value) => ({ value, label: value })),
          ]}
        />
        <FilterSelect
          label="Blocked reason"
          value={blockedFilter}
          onChange={setBlockedFilter}
          options={[
            { value: 'all', label: 'Any' },
            { value: 'blocked', label: 'Has blocked reason' },
            { value: 'unblocked', label: 'No blocked reason' },
          ]}
        />
        <FilterSelect
          label="promotionBlocked"
          value={promotionBlockedFilter}
          onChange={setPromotionBlockedFilter}
          options={[
            { value: 'all', label: 'Any' },
            { value: 'true', label: 'true' },
            { value: 'false', label: 'false' },
          ]}
        />
      </div>

      {classFilter === WAVE1_REVIEW_CLASS ? (
        <Wave1ReviewGuidancePanel candidateCount={filtered.length} />
      ) : null}

      {classFilter === WAVE2_REVIEW_CLASS ? (
        <Wave2ReviewGuidancePanel candidateCount={filtered.length} />
      ) : null}

      {classFilter === WAVE3_REVIEW_CLASS ? (
        <Wave3ReviewGuidancePanel candidateCount={filtered.length} />
      ) : null}

      {workbenchView === 'matcherImprovement' ? (
        <MatcherImprovementReviewGuidancePanel itemCount={filtered.length} />
      ) : null}

      {deltaPopulation ? (
        <DeltaReconciliationGuidancePanel population={deltaPopulation} itemCount={filtered.length} />
      ) : null}

      {isMatcherReconciled ? (
        <MatcherReconciledCandidateGuidancePanel itemCount={filtered.length} />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div
          ref={candidateListRef}
          className={`${SOLOMON_GLASS_PANEL_CLASS} overflow-hidden scroll-mt-3`}
        >
          <div className="border-b border-white/10 px-3 py-2 text-xs text-[var(--solomon-text-muted)]">
            {workbenchView === 'matcherImprovement'
              ? `${filtered.length} matcher backlog items`
              : isMatcherReconciled
                ? `${filtered.length} matcher-reconciled candidates`
              : deltaPopulation === 'A'
                ? `${filtered.length} Population A deltas`
                : deltaPopulation === 'B'
                  ? `${filtered.length} Population B drift records`
                  : `${filtered.length} candidates`}
          </div>
          <ul className="max-h-[38vh] overflow-y-auto divide-y divide-white/5 lg:max-h-[70vh]">
            {filtered.map((record) => {
              if (isMatcherReconciled) {
                const label = record.indexSnapshot?.what?.sourceTerm || record.candidateKey;
                return (
                  <li key={record.decisionId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(record.decisionId)}
                      className={classNames(
                        'w-full px-3 py-2 text-left hover:bg-white/5',
                        selectedId === record.decisionId && 'bg-white/10',
                      )}
                    >
                      <div className="text-sm font-semibold text-[var(--solomon-text-primary)] truncate">
                        {label}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[var(--solomon-text-secondary)] truncate">
                        → {record.currentProposedCanonicalId || '—'}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-[var(--solomon-text-muted)]">
                        <span>{record.manualId}</span>
                        <span>{record.currentReviewClass}</span>
                        <span>{record.reviewStatus || 'unreviewed'}</span>
                      </div>
                    </button>
                  </li>
                );
              }
              if (deltaPopulation) {
                return (
                  <li key={record.decisionId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(record.decisionId)}
                      className={classNames(
                        'w-full px-3 py-2 text-left hover:bg-white/5',
                        selectedId === record.decisionId && 'bg-white/10',
                      )}
                    >
                      <div className="text-sm font-semibold text-[var(--solomon-text-primary)] truncate">
                        {record.sourceTerm || record.candidateKey}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[var(--solomon-text-secondary)] truncate">
                        <span className="text-[var(--solomon-text-muted)]">{record.baselineClassification}</span>
                        {' → '}
                        <span className="font-semibold text-amber-100">{record.stagedClassification}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-[var(--solomon-text-muted)]">
                        <span>{record.manualId}</span>
                        {record.historicalDecisionConflict ? <span className="text-red-300">conflict</span> : null}
                        <span>{record.reviewStatus || 'unreviewed'}</span>
                      </div>
                    </button>
                  </li>
                );
              }
              if (workbenchView === 'matcherImprovement') {
                return (
                  <li key={record.backlogId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(record.backlogId)}
                      className={classNames(
                        'w-full px-3 py-2 text-left hover:bg-white/5',
                        selectedId === record.backlogId && 'bg-white/10',
                      )}
                    >
                      <div className="text-sm font-semibold text-[var(--solomon-text-primary)] truncate">
                        {record.terminologyClusterKey || record.backlogId}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[var(--solomon-text-secondary)] truncate">
                        <span className="text-[var(--solomon-text-muted)]">→ </span>
                        <span className="font-semibold text-[var(--solomon-text-primary)]">
                          {record.frozenCanonicalId}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-[var(--solomon-text-muted)]">
                        <span>{record.category}</span>
                        <span>{record.reviewStatus || 'unreviewed'}</span>
                        <span>{record.affectedRecordCount} records</span>
                      </div>
                    </button>
                  </li>
                );
              }
              const wave3Row = isNewCanonicalKnowledgeCandidate(record);
              const wave2Row = !wave3Row && isNewPlatformKnowledgeCandidate(record);
              const waveHighlightRow = wave3Row || wave2Row;
              const mapsToParts = wave3Row
                ? {
                  highlight: wave3ListRowMapsToHighlight(record),
                  detail: wave3ListRowMapsToDetail(record),
                }
                : wave2Row
                  ? {
                    highlight: wave2ListRowMapsToHighlight(record),
                    detail: wave2ListRowMapsToDetail(record),
                  }
                  : mapsToCollapsedParts(record);
              const rowPrimary = wave3Row
                ? wave3ListRowPrimaryLabel(record)
                : wave2Row
                  ? wave2ListRowPrimaryLabel(record)
                  : formatSourceTermLabel(record);
              return (
              <li key={record.candidateId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(record.candidateId)}
                  className={classNames(
                    'w-full px-3 py-2 text-left hover:bg-white/5',
                    selectedId === record.candidateId && 'bg-white/10',
                  )}
                >
                  <div className="text-sm font-semibold text-[var(--solomon-text-primary)] truncate">
                    {rowPrimary}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--solomon-text-secondary)] truncate">
                    <span className="text-[var(--solomon-text-muted)]">→ </span>
                    <span className="font-semibold text-[var(--solomon-text-primary)]">
                      {mapsToParts.highlight}
                    </span>
                    {mapsToParts.detail ? (
                      <span
                        className={waveHighlightRow ? ' font-semibold text-[var(--solomon-text-primary)]' : ''}
                      >
                        {` · ${mapsToParts.detail}`}
                      </span>
                    ) : null}
                  </div>
                  {waveHighlightRow && record.what?.sourceTerm ? (
                    <div className="mt-0.5 truncate text-[10px] text-[var(--solomon-text-muted)]">
                      {record.what.sourceTerm}
                    </div>
                  ) : null}
                  <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-[var(--solomon-text-muted)]">
                    <span>{record.manualId}</span>
                    <span>{REVIEW_CLASS_LABELS[record.reviewClass] || record.reviewClass}</span>
                    <span>{record.reviewStatus || 'unreviewed'}</span>
                  </div>
                </button>
              </li>
              );
            })}
          </ul>
        </div>

        <div
          ref={detailPanelRef}
          className={`${SOLOMON_GLASS_PANEL_CLASS} p-4 space-y-4 min-h-[40vh] scroll-mt-3`}
        >
          {isMatcherReconciled ? (
            <MatcherReconciledCandidateDetailPanel
              selected={selected}
              selectedStatus={selectedStatus}
              saving={saving}
              decisionsLoading={matcherReconciledDecisionsLoading}
              error={error}
              onDecision={submitDecision}
            />
          ) : deltaPopulation ? (
            <DeltaReconciliationDetailPanel
              selected={selected}
              selectedStatus={selectedStatus}
              population={deltaPopulation}
              saving={saving}
              decisionsLoading={deltaDecisionsLoading}
              error={error}
              onDecision={submitDecision}
            />
          ) : workbenchView === 'matcherImprovement' ? (
            <MatcherImprovementDetailPanel
              selected={selected}
              selectedStatus={selectedStatus}
              saving={saving}
              decisionsLoading={matcherDecisionsLoading}
              error={error}
              onDecision={submitDecision}
            />
          ) : (
            <CandidateReviewDetailPanel
              selected={selected}
              selectedStatus={selectedStatus}
              selectedReconciliation={selectedReconciliation}
              saving={saving}
              decisionsLoading={decisionsLoading}
              error={error}
              onDecision={submitDecision}
            />
          )}
        </div>
      </div>
    </div>
  );
}
