import { SOLOMON_GLASS_PANEL_CLASS, SOLOMON_REFERENCE_EYEBROW_CLASS } from '../solomonListPageUi';
import { WAVE3_GUIDANCE, WAVE3_GUIDANCE_TITLE } from './wave3ReviewGuidance';

export default function Wave3ReviewGuidancePanel({ candidateCount }) {
  const { decisions } = WAVE3_GUIDANCE;

  return (
    <div
      className={`${SOLOMON_GLASS_PANEL_CLASS} border-violet-500/30 bg-violet-500/5 p-3 space-y-3`}
      data-testid="wave3-review-guidance"
    >
      <div>
        <p className={SOLOMON_REFERENCE_EYEBROW_CLASS}>{WAVE3_GUIDANCE_TITLE}</p>
        <p className="mt-1 text-[11px] text-[var(--solomon-text-muted)]">
          {candidateCount} candidates in current filter
        </p>
      </div>

      <p className="text-[11px] text-[var(--solomon-text-secondary)]">{WAVE3_GUIDANCE.waveMeaning}</p>
      <p className="text-[11px] text-violet-100/90">{WAVE3_GUIDANCE.waveContrast}</p>

      <div className="grid gap-2 md:grid-cols-3 text-[11px]">
        <div className="rounded-md border border-white/10 bg-black/10 p-2">
          <p className="font-semibold text-[var(--solomon-text-primary)]">{decisions.accepted.label}</p>
          <p className="mt-1 text-[var(--solomon-text-secondary)]">{decisions.accepted.guidance}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-black/10 p-2">
          <p className="font-semibold text-[var(--solomon-text-primary)]">{decisions.rejected.label}</p>
          <p className="mt-1 text-[var(--solomon-text-secondary)]">{decisions.rejected.guidance}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-black/10 p-2">
          <p className="font-semibold text-[var(--solomon-text-primary)]">{decisions.deferred.label}</p>
          <p className="mt-1 text-[var(--solomon-text-secondary)]">{decisions.deferred.guidance}</p>
        </div>
      </div>

      <p className="text-[11px] text-amber-100/90">{WAVE3_GUIDANCE.promotionBoundary}</p>
      <p className="text-[11px] text-[var(--solomon-text-muted)]">{WAVE3_GUIDANCE.architecturePath}</p>
      <p className="text-[11px] text-[var(--solomon-text-muted)]">{WAVE3_GUIDANCE.evidenceHierarchy}</p>
      <p className="text-[11px] text-[var(--solomon-text-muted)]">{WAVE3_GUIDANCE.sourceTermWarning}</p>
    </div>
  );
}
