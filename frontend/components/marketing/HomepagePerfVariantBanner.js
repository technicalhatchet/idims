import { HOMEPAGE_PERF_TIMING_INLINE_SCRIPT } from '../../lib/homepagePerfTimingInlineScript';

/**
 * Visible variant label + passive timing line (Preview perf experiments only).
 */
export default function HomepagePerfVariantBanner({ label }) {
  if (!label) return null;

  return (
    <div
      id="homepage-perf-variant-banner"
      className="relative z-[60] border-b border-amber-500/40 bg-amber-950/95 px-4 py-2 text-amber-100"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold tracking-wide">{label}</p>
      <p
        id="homepage-perf-timing"
        className="mt-1 font-mono text-xs leading-snug text-amber-200/90"
      >
        timing: (waiting for load)…
      </p>
      <script dangerouslySetInnerHTML={{ __html: HOMEPAGE_PERF_TIMING_INLINE_SCRIPT }} />
    </div>
  );
}
