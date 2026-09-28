import DeltaReconciliationDecisionBar from './DeltaReconciliationDecisionBar';

function KeyValue({ label, value, highlight }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <p className={highlight ? 'text-[11px] font-semibold text-amber-100' : 'text-[11px] leading-snug'}>
      <span className="text-[var(--solomon-text-muted)]">{label} </span>
      <span className="text-[var(--solomon-text-primary)]">{String(value)}</span>
    </p>
  );
}

export default function DeltaReconciliationDetailPanel({
  selected,
  selectedStatus,
  population,
  saving,
  decisionsLoading,
  error,
  onDecision,
}) {
  if (!selected) {
    return (
      <p className="text-sm text-[var(--solomon-text-muted)]">Select a delta record to reconcile.</p>
    );
  }

  return (
    <div className="space-y-4" data-testid="delta-reconciliation-review-detail">
      <DeltaReconciliationDecisionBar
        population={population}
        selectedStatus={selectedStatus}
        saving={saving}
        decisionsLoading={decisionsLoading}
        error={error}
        onDecision={onDecision}
      />

      {selected.historicalDecisionConflict ? (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-200">
          HISTORICAL_DECISION_CONFLICT — Wave 1/2 accepted target differs from staged. Explicit reconciliation required.
        </p>
      ) : null}

      <div>
        <h2 className="text-sm font-semibold text-[var(--solomon-text-primary)] truncate">
          {selected.sourceTerm || selected.candidateKey}
        </h2>
        <p className="mt-1 text-[10px] text-[var(--solomon-text-muted)]">{selected.candidateKey}</p>
      </div>

      <div className="grid gap-3 border-t border-white/10 pt-3 sm:grid-cols-2">
        <div className="space-y-1 rounded border border-white/10 bg-black/20 p-2">
          <p className="text-[10px] uppercase text-[var(--solomon-text-muted)]">Production baseline</p>
          <KeyValue label="Class:" value={selected.baselineClassification} />
          <KeyValue label="Target:" value={selected.baselineProposedCanonicalId} />
        </div>
        <div className="space-y-1 rounded border border-amber-500/30 bg-amber-500/5 p-2">
          <p className="text-[10px] uppercase text-amber-100/80">Staged regen</p>
          <KeyValue label="Class:" value={selected.stagedClassification} highlight />
          <KeyValue label="Target:" value={selected.stagedProposedCanonicalId} highlight />
        </div>
      </div>

      <div className="space-y-1 border-t border-white/10 pt-3">
        <KeyValue label="Manual:" value={selected.manualId} />
        <KeyValue label="Procedure:" value={selected.procedureId} />
        <KeyValue label="Procedure family:" value={selected.procedureFamily} />
        {population === 'A' ? (
          <>
            <KeyValue label="Backlog ID:" value={selected.backlogId} />
            <KeyValue label="Approved target:" value={selected.approvedTarget} />
          </>
        ) : null}
        <KeyValue label="Staging comparison:" value={selected.stagingComparison} />
        <KeyValue label="Why staged changed:" value={selected.whyStagedChanged} />
        {population === 'B' ? (
          <KeyValue label="Category A note:" value={selected.categoryAExplanation} />
        ) : null}
        {population === 'B' && selected.driftSourceSets?.length ? (
          <KeyValue label="Drift sets:" value={selected.driftSourceSets.join(', ')} />
        ) : null}
      </div>

      {(selected.waveMatches || []).length ? (
        <div className="space-y-1 border-t border-white/10 pt-3">
          <p className="text-[10px] uppercase text-[var(--solomon-text-muted)]">Historical wave context</p>
          {selected.waveMatches.map((match) => (
            <p key={`${match.wave}-${match.candidateId}`} className="text-[11px] text-[var(--solomon-text-secondary)]">
              {match.wave}: {match.reviewStatus} → {match.acceptedTarget}
              {match.historicalDecisionConflict ? ' (conflict)' : ''}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
