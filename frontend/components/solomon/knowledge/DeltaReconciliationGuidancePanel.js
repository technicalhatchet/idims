export default function DeltaReconciliationGuidancePanel({ population, itemCount }) {
  const isA = population === 'A';
  return (
    <div
      className="rounded-lg border border-white/10 bg-black/20 p-3 text-[11px] text-[var(--solomon-text-secondary)]"
      data-testid="delta-reconciliation-guidance"
    >
      <p className="font-semibold text-[var(--solomon-text-primary)]">
        {isA ? 'Population A — authorized matcher improvements' : 'Population B — matcher/snapshot drift'}
        {' '}
        ({itemCount} records)
      </p>
      <p className="mt-1">
        {isA
          ? 'These 46 mappings were produced by the 9 approved matcher backlog rules. Your decision is whether the staged candidate should become the production representation — not ontology promotion and not rewriting Wave 1/2 decisions.'
          : 'Independent review of current-matcher vs batch-snapshot drift. Category A explanation does not imply correctness. Decisions stay isolated from the 796 production review decisions until a later reconciliation gate.'}
      </p>
    </div>
  );
}
