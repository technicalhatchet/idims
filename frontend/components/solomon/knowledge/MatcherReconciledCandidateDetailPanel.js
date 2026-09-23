import ReviewDecisionBar from './ReviewDecisionBar';
import { EXISTING_CANONICAL_MAPPING_NOTICE } from './candidateReviewWorkflow';

function KeyValue({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <p className="text-[11px] leading-snug">
      <span className="text-[var(--solomon-text-muted)]">{label} </span>
      <span className="text-[var(--solomon-text-primary)]">{String(value)}</span>
    </p>
  );
}

export default function MatcherReconciledCandidateDetailPanel({
  selected,
  selectedStatus,
  saving,
  decisionsLoading,
  error,
  onDecision,
}) {
  if (!selected) {
    return (
      <p className="text-sm text-[var(--solomon-text-muted)]">
        Select a matcher-reconciled candidate to review.
      </p>
    );
  }

  const snapshot = selected.indexSnapshot || {};
  const matcher = selected.matcherImprovement || {};

  return (
    <div className="space-y-4" data-testid="matcher-reconciled-candidate-review-detail">
      <ReviewDecisionBar
        selectedStatus={selectedStatus}
        saving={saving}
        decisionsLoading={decisionsLoading}
        error={error}
        onDecision={onDecision}
      />

      <p className="rounded border border-cyan-500/30 bg-cyan-500/5 px-2 py-1 text-[11px] text-cyan-100/90">
        Matcher backlog authorized generation; delta reconciliation authorized production entry.
        This accept/defer/reject records <strong>candidate knowledge</strong> acceptance only.
      </p>

      {selected.currentReviewClass === 'existingCanonicalMapping' ? (
        <p className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-[var(--solomon-text-muted)]">
          {EXISTING_CANONICAL_MAPPING_NOTICE}
        </p>
      ) : null}

      <div>
        <h2 className="text-sm font-semibold text-[var(--solomon-text-primary)] truncate">
          {snapshot.what?.sourceTerm || selected.candidateKey}
        </h2>
        <p className="mt-1 text-[10px] text-[var(--solomon-text-muted)]">{selected.candidateId}</p>
      </div>

      <div className="grid gap-3 border-t border-white/10 pt-3 sm:grid-cols-2">
        <div className="space-y-1 rounded border border-white/10 bg-black/20 p-2">
          <p className="text-[10px] uppercase text-[var(--solomon-text-muted)]">Current production index</p>
          <KeyValue label="Class:" value={selected.currentReviewClass} />
          <KeyValue label="Target:" value={selected.currentProposedCanonicalId} />
        </div>
        <div className="space-y-1 rounded border border-cyan-500/30 bg-cyan-500/5 p-2">
          <p className="text-[10px] uppercase text-cyan-100/80">Matcher improvement</p>
          <KeyValue label="Backlog ID:" value={matcher.backlogId} />
          <KeyValue label="Approved target:" value={matcher.approvedTarget} />
          <KeyValue label="Delta reconciliation:" value={selected.deltaReconciliationDecision} />
        </div>
      </div>

      <div className="space-y-1 border-t border-white/10 pt-3">
        <KeyValue label="Manual:" value={selected.manualId} />
        <KeyValue label="Procedure:" value={selected.procedureId} />
        <KeyValue label="Procedure family:" value={selected.procedureFamily} />
        <KeyValue label="Candidate key:" value={selected.candidateKey} />
        <KeyValue label="Historical decision:" value={selected.historicalDecisionStatus} />
        <KeyValue label="Pages:" value={(snapshot.where?.pages || []).join(', ')} />
        <KeyValue label="Extraction doc:" value={snapshot.where?.extractionDoc} />
        <KeyValue label="Platform:" value={snapshot.context?.platformId} />
        <KeyValue label="Mapping type:" value={snapshot.mapsTo?.mappingType} />
        <KeyValue label="Candidate status:" value={snapshot.why?.candidateStatus} />
      </div>
    </div>
  );
}
