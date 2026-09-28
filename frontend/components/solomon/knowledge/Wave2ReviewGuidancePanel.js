import { SOLOMON_GLASS_PANEL_CLASS, SOLOMON_REFERENCE_EYEBROW_CLASS } from '../solomonListPageUi';
import { WAVE2_GUIDANCE, WAVE2_GUIDANCE_TITLE } from './wave2ReviewGuidance';

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

export default function Wave2ReviewGuidancePanel({ candidateCount }) {
  const { decisions } = WAVE2_GUIDANCE;

  return (
    <section
      className={`${SOLOMON_GLASS_PANEL_CLASS} border-violet-500/25 bg-violet-500/5 p-3 space-y-3`}
      data-testid="wave2-review-guidance"
    >
      <div>
        <p className={SOLOMON_REFERENCE_EYEBROW_CLASS}>{WAVE2_GUIDANCE_TITLE}</p>
        {typeof candidateCount === 'number' ? (
          <p className="mt-1 text-[10px] text-[var(--solomon-text-muted)]">
            {candidateCount} candidates in this wave (426 expected).
          </p>
        ) : null}
      </div>

      <p className="text-[11px] text-[var(--solomon-text-secondary)]">{WAVE2_GUIDANCE.waveMeaning}</p>

      <div className="grid gap-3 md:grid-cols-3">
        <DecisionBlock decision={decisions.accepted} />
        <DecisionBlock decision={decisions.rejected} />
        <DecisionBlock decision={decisions.deferred} />
      </div>

      <div className="space-y-1 border-t border-white/10 pt-2 text-[11px] text-[var(--solomon-text-secondary)]">
        <p>
          <strong className="text-[var(--solomon-text-primary)]">Critical boundary:</strong>
          {' '}
          {WAVE2_GUIDANCE.promotionBoundary}
        </p>
        <p>
          <strong className="text-[var(--solomon-text-primary)]">New canonical abstractions:</strong>
          {' '}
          {WAVE2_GUIDANCE.newCanonicalRule}
        </p>
        <p>
          <strong className="text-[var(--solomon-text-primary)]">Evidence hierarchy:</strong>
          {' '}
          {WAVE2_GUIDANCE.evidenceHierarchy}
        </p>
        <p>
          <strong className="text-[var(--solomon-text-primary)]">Known corpus patterns:</strong>
          {' '}
          {WAVE2_GUIDANCE.patternAwareness}
        </p>
      </div>
    </section>
  );
}
