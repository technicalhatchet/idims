import type {
  DmaEvidenceNudge,
  EvidenceConfig,
  EvidenceLedgerEntry,
} from './evidenceTypes';

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Bounded historical nudge: +5 to +15 based on case count. */
export function computeDmaNudgeDelta(caseCount: number): number {
  if (caseCount <= 0) return 0;
  return Math.min(15, Math.max(5, 5 + Math.min(10, caseCount)));
}

/**
 * Apply DMA historical nudges to category scores only.
 * Does not modify component confirm/eliminate states (spec 6d).
 */
export function applyDmaHistoricalNudges(
  config: EvidenceConfig,
  categoryScores: Map<string, number>,
  ledger: EvidenceLedgerEntry[],
  nudges: DmaEvidenceNudge[] | null | undefined,
): number {
  if (!nudges?.length) return 0;

  const categoryNudgeApplied = new Map<string, number>();
  let nudgeLines = 0;

  for (const nudge of nudges) {
    const delta = computeDmaNudgeDelta(nudge.caseCount);
    if (delta <= 0) continue;

    const categories = config.categories.filter((category) =>
      (category.dmaTags || []).includes(nudge.tag),
    );
    if (!categories.length) continue;

    for (const category of categories) {
      const already = categoryNudgeApplied.get(category.id) || 0;
      const remaining = 15 - already;
      if (remaining <= 0) continue;

      const appliedDelta = Math.min(delta, remaining);
      categoryScores.set(
        category.id,
        clampScore((categoryScores.get(category.id) || 0) + appliedDelta),
      );
      categoryNudgeApplied.set(category.id, already + appliedDelta);
      ledger.push({
        ruleId: `dma_nudge_${nudge.tag}`,
        target: category.id,
        targetLayer: 'category',
        delta: appliedDelta,
        explanation: `Similar repairs: ${nudge.label.toLowerCase()} (${nudge.caseCount} cases)`,
        effect: 'increase',
        source: 'dma',
      });
      nudgeLines += 1;
    }
  }

  return nudgeLines;
}
