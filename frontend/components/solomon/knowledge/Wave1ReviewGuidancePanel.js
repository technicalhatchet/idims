import { SOLOMON_GLASS_PANEL_CLASS, SOLOMON_REFERENCE_EYEBROW_CLASS } from '../solomonListPageUi';
import { WAVE1_GUIDANCE, WAVE1_GUIDANCE_TITLE } from './wave1ReviewGuidance';

function DecisionBlock({ decision }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium text-[var(--solomon-text-primary)]">{decision.label}</p>
      <p className="text-[11px] text-[var(--solomon-text-secondary)]">{decision.guidance}</p>
      <p className="text-[10px] text-[var(--solomon-text-muted)]">
        Example: {decision.example}
      </p>
    </div>
  );
}

export default function Wave1ReviewGuidancePanel({ candidateCount }) {
  const { decisions } = WAVE1_GUIDANCE;

  return (
    <section
      className={`${SOLOMON_GLASS_PANEL_CLASS} border-cyan-500/25 bg-cyan-500/5 p-3 space-y-3`}
      data-testid="wave1-review-guidance"
    >
      <div>
        <p className={SOLOMON_REFERENCE_EYEBROW_CLASS}>{WAVE1_GUIDANCE_TITLE}</p>
        {typeof candidateCount === 'number' ? (
          <p className="mt-1 text-[10px] text-[var(--solomon-text-muted)]">
            {candidateCount} candidates in this wave (370 expected across 45 manuals).
          </p>
        ) : null}
      </div>

      <p className="text-[11px] text-[var(--solomon-text-secondary)]">{WAVE1_GUIDANCE.waveMeaning}</p>

      <div className="grid gap-3 md:grid-cols-3">
        <DecisionBlock decision={decisions.accepted} />
        <DecisionBlock decision={decisions.rejected} />
        <DecisionBlock decision={decisions.deferred} />
      </div>

      <div className="space-y-1 border-t border-white/10 pt-2 text-[11px] text-[var(--solomon-text-secondary)]">
        <p>
          <strong className="text-[var(--solomon-text-primary)]">Critical boundary:</strong>
          {' '}
          {WAVE1_GUIDANCE.promotionBoundary}
        </p>
        <p>
          <strong className="text-[var(--solomon-text-primary)]">New canonical abstractions:</strong>
          {' '}
          {WAVE1_GUIDANCE.newCanonicalRule}
        </p>
        <p>
          <strong className="text-[var(--solomon-text-primary)]">Evidence hierarchy:</strong>
          {' '}
          {WAVE1_GUIDANCE.evidenceHierarchy}
        </p>
      </div>
    </section>
  );
}
