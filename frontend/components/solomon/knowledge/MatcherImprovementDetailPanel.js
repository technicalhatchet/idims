import MatcherImprovementDecisionBar from './MatcherImprovementDecisionBar';
import { SectionPreviewBlock } from './CandidateReviewDetailPanel';

function KeyValue({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <p className="text-[11px] leading-snug">
      <span className="text-[var(--solomon-text-muted)]">{label} </span>
      <span className="font-semibold text-[var(--solomon-text-primary)]">{String(value)}</span>
    </p>
  );
}

export default function MatcherImprovementDetailPanel({
  selected,
  selectedStatus,
  saving,
  decisionsLoading,
  error,
  onDecision,
}) {
  if (!selected) {
    return (
      <p className="text-sm text-[var(--solomon-text-muted)]">Select a backlog item to review.</p>
    );
  }

  const brief = selected.reviewerBrief || {};

  return (
    <div className="space-y-4" data-testid="matcher-improvement-review-detail">
      <MatcherImprovementDecisionBar
        selectedStatus={selectedStatus}
        saving={saving}
        decisionsLoading={decisionsLoading}
        error={error}
        onDecision={onDecision}
      />

      <div>
        <h2 className="text-sm font-semibold text-[var(--solomon-text-primary)]">
          {selected.terminologyClusterKey || selected.backlogId}
          {' → '}
          {selected.frozenCanonicalId || '—'}
        </h2>
        <p className="mt-1 text-[10px] text-[var(--solomon-text-muted)]">{selected.backlogId}</p>
      </div>

      <div className="space-y-2 border-t border-white/10 pt-3">
        <KeyValue label="Frozen target:" value={brief.frozenCanonicalTarget} />
        <KeyValue label="Category:" value={selected.category} />
        <KeyValue label="Failure mode:" value={brief.matchingFailureMode} />
        <KeyValue label="Confidence:" value={selected.confidence} />
        <KeyValue
          label="Coverage:"
          value={`${brief.coverage?.manualCount ?? '—'} manuals · ${brief.coverage?.platformCount ?? '—'} platforms · ${brief.coverage?.manufacturerCount ?? '—'} manufacturers`}
        />
        <KeyValue label="Procedure families:" value={(brief.procedureFamilies || []).join(', ')} />
      </div>

      <div className="space-y-1 border-t border-white/10 pt-3">
        <p className="text-[10px] uppercase tracking-wide text-[var(--solomon-text-muted)]">Terminology</p>
        <SectionPreviewBlock
          preview={{
            primary: brief.affectedTerminology?.clusterKey || '—',
            secondaryLines: (brief.affectedTerminology?.sourceExamples || []).map((term) => ({
              label: 'example:',
              value: term,
            })),
          }}
        />
      </div>

      <div className="space-y-1 border-t border-white/10 pt-3">
        <p className="text-[10px] uppercase tracking-wide text-[var(--solomon-text-muted)]">Accepted sibling evidence</p>
        {(brief.acceptedSiblingExamples || []).map((sibling) => (
          <p key={`${sibling.candidateId}-${sibling.proposedCanonicalId}`} className="text-[11px] text-[var(--solomon-text-secondary)]">
            <span className="text-[var(--solomon-text-muted)]">{sibling.sourceTerm}</span>
            {' → '}
            <span className="font-semibold text-[var(--solomon-text-primary)]">{sibling.proposedCanonicalId}</span>
          </p>
        ))}
      </div>

      <div className="space-y-1 border-t border-white/10 pt-3 text-[11px] text-[var(--solomon-text-secondary)]">
        <p><span className="text-[var(--solomon-text-muted)]">Why considered safe: </span>{brief.whyConsideredSafe}</p>
        <p><span className="text-[var(--solomon-text-muted)]">False-positive risk: </span>{brief.falsePositiveRisk}</p>
        <p><span className="text-[var(--solomon-text-muted)]">Proposed narrow behavior: </span>{brief.proposedNarrowMatcherOrAliasBehavior}</p>
      </div>

      <div className="border-t border-white/10 pt-3">
        <p className="text-[10px] uppercase tracking-wide text-[var(--solomon-text-muted)]">Provenance</p>
        <p className="mt-1 text-[10px] text-[var(--solomon-text-muted)] break-all">
          {(brief.provenanceRecordIds || []).slice(0, 8).join(' · ')}
          {(brief.provenanceRecordIds || []).length > 8 ? ' …' : ''}
        </p>
      </div>
    </div>
  );
}
