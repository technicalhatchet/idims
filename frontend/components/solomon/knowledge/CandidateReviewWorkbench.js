import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SOLOMON_GLASS_PANEL_CLASS,
  SOLOMON_REFERENCE_EYEBROW_CLASS,
} from '../solomonListPageUi';
import reviewIndex from '../../diagnostics/knowledge/normalization/review/CG_PRODUCTION_NORMALIZATION_CANDIDATE_REVIEW_INDEX_v1.json';
import {
  decisionsMapFromStore,
  EXISTING_CANONICAL_MAPPING_NOTICE,
  formatWhereProvenance,
  mergeHydratedDecisions,
  NEW_CANONICAL_KNOWLEDGE_NOTICE,
  REVIEW_CLASS_LABELS,
  REVIEW_DECISIONS_API,
} from './candidateReviewWorkflow';
import Wave1ReviewGuidancePanel from './Wave1ReviewGuidancePanel';
import Wave2ReviewGuidancePanel from './Wave2ReviewGuidancePanel';
import { WAVE1_REVIEW_CLASS } from './wave1ReviewGuidance';
import { WAVE2_REVIEW_CLASS } from './wave2ReviewGuidance';

const REVIEW_CLASSES = Object.keys(REVIEW_CLASS_LABELS);
const REVIEW_STATUSES = ['unreviewed', 'accepted', 'rejected', 'deferred'];

function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
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

function DetailSection({ title, children }) {
  return (
    <section className="space-y-1.5">
      <h3 className={SOLOMON_REFERENCE_EYEBROW_CLASS}>{title}</h3>
      <div className="text-xs text-[var(--solomon-text-secondary)] whitespace-pre-wrap break-words">
        {children}
      </div>
    </section>
  );
}

export default function CandidateReviewWorkbench() {
  const [manualFilter, setManualFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [blockedFilter, setBlockedFilter] = useState('all');
  const [promotionBlockedFilter, setPromotionBlockedFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [decisionState, setDecisionState] = useState({});
  const [decisionsLoading, setDecisionsLoading] = useState(true);
  const [decisionsLoadError, setDecisionsLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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

    hydrateDecisions();
    return () => {
      cancelled = true;
    };
  }, []);

  const records = useMemo(
    () => mergeHydratedDecisions(baseRecords, { decisions: Object.fromEntries(
      Object.entries(decisionState).map(([candidateId, reviewStatus]) => [
        candidateId,
        { candidateId, reviewStatus },
      ]),
    ) }),
    [baseRecords, decisionState],
  );

  const manualOptions = useMemo(() => {
    const manuals = [...new Set(records.map((record) => record.manualId))].sort();
    return [{ value: 'all', label: 'All manuals' }, ...manuals.map((manual) => ({ value: manual, label: manual }))];
  }, [records]);

  const typeOptions = useMemo(() => {
    const types = [...new Set(records.map((record) => record.mapsTo?.candidateType).filter(Boolean))].sort();
    return [{ value: 'all', label: 'All types' }, ...types.map((type) => ({ value: type, label: type }))];
  }, [records]);

  const filtered = useMemo(() => records.filter((record) => {
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
    records,
    manualFilter,
    classFilter,
    typeFilter,
    statusFilter,
    blockedFilter,
    promotionBlockedFilter,
  ]);

  const selected = filtered.find((record) => record.candidateId === selectedId)
    || records.find((record) => record.candidateId === selectedId)
    || null;

  const submitDecision = useCallback(async (reviewStatus) => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(REVIEW_DECISIONS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: selected.candidateId,
          reviewStatus,
          manualId: selected.manualId,
          batchRunId: reviewIndex.batchRunId,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save review decision');
      }
      setDecisionState((current) => ({
        ...current,
        [selected.candidateId]: reviewStatus,
      }));
    } catch (err) {
      setError(err.message || 'Failed to save review decision');
    } finally {
      setSaving(false);
    }
  }, [selected]);

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
        </p>
      </div>

      <div className={`${SOLOMON_GLASS_PANEL_CLASS} grid gap-3 p-3 md:grid-cols-3 lg:grid-cols-6`}>
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className={`${SOLOMON_GLASS_PANEL_CLASS} overflow-hidden`}>
          <div className="border-b border-white/10 px-3 py-2 text-xs text-[var(--solomon-text-muted)]">
            {filtered.length} candidates
          </div>
          <ul className="max-h-[70vh] overflow-y-auto divide-y divide-white/5">
            {filtered.map((record) => (
              <li key={record.candidateId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(record.candidateId)}
                  className={classNames(
                    'w-full px-3 py-2 text-left hover:bg-white/5',
                    selectedId === record.candidateId && 'bg-white/10',
                  )}
                >
                  <div className="text-xs font-medium text-[var(--solomon-text-primary)] truncate">
                    {record.what?.sourceTerm || record.candidateId}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-[var(--solomon-text-muted)]">
                    <span>{record.manualId}</span>
                    <span>{REVIEW_CLASS_LABELS[record.reviewClass] || record.reviewClass}</span>
                    <span>{record.reviewStatus || 'unreviewed'}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className={`${SOLOMON_GLASS_PANEL_CLASS} p-4 space-y-4 min-h-[40vh]`}>
          {!selected ? (
            <p className="text-sm text-[var(--solomon-text-muted)]">Select a candidate to inspect provenance and decide.</p>
          ) : (
            <>
              <div>
                <p className={SOLOMON_REFERENCE_EYEBROW_CLASS}>Candidate</p>
                <h2 className="text-sm font-medium text-[var(--solomon-text-primary)]">
                  {selected.what?.sourceTerm || selected.candidateId}
                </h2>
                <p className="mt-1 text-[11px] text-[var(--solomon-text-muted)]">{selected.candidateId}</p>
              </div>

              <DetailSection title="What">
                manualId: {selected.what?.manualId}
                {'\n'}procedureId: {selected.what?.procedureId || '—'}
                {'\n'}sourceTerm: {selected.what?.sourceTerm || '—'}
              </DetailSection>

              <DetailSection title="Where / Provenance">
                {formatWhereProvenance(selected)}
              </DetailSection>

              <DetailSection title="Maps to">
                proposedCanonicalId: {selected.mapsTo?.proposedCanonicalId || '—'}
                {'\n'}mappingType: {selected.mapsTo?.mappingType || '—'}
                {'\n'}candidateType: {selected.mapsTo?.candidateType || '—'}
              </DetailSection>

              {selected.reviewClass === 'existingCanonicalMapping' ? (
                <div className="rounded-md border border-cyan-500/25 bg-cyan-500/5 p-2 text-[11px] text-cyan-100/90">
                  {EXISTING_CANONICAL_MAPPING_NOTICE}
                </div>
              ) : null}

              {selected.reviewClass === 'newCanonicalKnowledge' ? (
                <div className="rounded-md border border-amber-500/25 bg-amber-500/5 p-2 text-[11px] text-amber-100/90">
                  {NEW_CANONICAL_KNOWLEDGE_NOTICE}
                </div>
              ) : null}

              <DetailSection title="Why">
                {JSON.stringify(selected.why || {}, null, 2)}
              </DetailSection>

              <DetailSection title="Blockers">
                {JSON.stringify(selected.blockers || {}, null, 2)}
              </DetailSection>

              <DetailSection title="Context">
                {JSON.stringify(selected.context || {}, null, 2)}
              </DetailSection>

              {selectedReconciliation ? (
                <DetailSection title="Reconciliation">
                  {JSON.stringify(selectedReconciliation, null, 2)}
                </DetailSection>
              ) : null}

              <div className="border-t border-white/10 pt-3 space-y-2">
                <p className="text-[11px] text-[var(--solomon-text-muted)]">
                  Current review status: <span className="text-[var(--solomon-text-primary)]">{selectedStatus}</span>
                </p>
                {error ? <p className="text-xs text-red-300">{error}</p> : null}
                <div className="flex flex-wrap gap-2">
                  {['accepted', 'rejected', 'deferred'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={saving || decisionsLoading}
                      onClick={() => submitDecision(status)}
                      className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-[var(--solomon-text-primary)] hover:bg-white/10 disabled:opacity-50"
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
