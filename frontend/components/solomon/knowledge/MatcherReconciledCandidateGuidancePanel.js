export default function MatcherReconciledCandidateGuidancePanel({ itemCount }) {
  return (
    <div
      className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 text-xs text-cyan-50/90"
      data-testid="matcher-reconciled-candidate-guidance"
    >
      <p className="font-semibold text-cyan-100">Matcher-reconciled candidate review (52)</p>
      <p className="mt-1 text-[11px] text-[var(--solomon-text-muted)]">
        These mappings entered production via the approved matcher-improvement process and human delta
        reconciliation. This is <strong>not</strong> Wave 3 newCanonicalKnowledge and does not reopen
        Wave 1 or Wave 2.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px]">
        <li>
          <strong>Accept</strong> — valid production candidate knowledge (not canonical promotion).
        </li>
        <li>
          <strong>Defer</strong> — insufficient evidence; keep for later.
        </li>
        <li>
          <strong>Reject</strong> — mapping should not remain as accepted candidate knowledge.
        </li>
      </ul>
      <p className="mt-2 text-[10px] text-[var(--solomon-text-muted)]">
        Queue: {itemCount} scoped records · decisions stored separately from the 796 historical artifact.
      </p>
    </div>
  );
}
