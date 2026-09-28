import { SOLOMON_GLASS_PANEL_CLASS, SOLOMON_REFERENCE_EYEBROW_CLASS } from '../solomonListPageUi';
import { MATCHER_IMPROVEMENT_GUIDANCE, MATCHER_IMPROVEMENT_GUIDANCE_TITLE } from './matcherImprovementReviewGuidance';

export default function MatcherImprovementReviewGuidancePanel({ itemCount }) {
  const { decisions } = MATCHER_IMPROVEMENT_GUIDANCE;

  return (
    <div
      className={`${SOLOMON_GLASS_PANEL_CLASS} border-cyan-500/30 bg-cyan-500/5 p-3 space-y-3`}
      data-testid="matcher-improvement-review-guidance"
    >
      <div>
        <p className={SOLOMON_REFERENCE_EYEBROW_CLASS}>{MATCHER_IMPROVEMENT_GUIDANCE_TITLE}</p>
        <p className="mt-1 text-[11px] text-[var(--solomon-text-muted)]">
          {itemCount} backlog items in gate
        </p>
      </div>

      <p className="text-[11px] text-[var(--solomon-text-secondary)]">{MATCHER_IMPROVEMENT_GUIDANCE.gateMeaning}</p>

      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4 text-[11px]">
        {Object.entries(decisions).map(([key, value]) => (
          <div key={key} className="rounded-md border border-white/10 bg-black/10 p-2">
            <p className="font-semibold text-[var(--solomon-text-primary)]">{value.label}</p>
            <p className="mt-1 text-[var(--solomon-text-secondary)]">{value.guidance}</p>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-amber-100/90">{MATCHER_IMPROVEMENT_GUIDANCE.promotionBoundary}</p>
      <p className="text-[11px] text-[var(--solomon-text-muted)]">{MATCHER_IMPROVEMENT_GUIDANCE.sourceTermWarning}</p>
    </div>
  );
}
