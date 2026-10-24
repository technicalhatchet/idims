/**
 * Decorative titleplate glow without CSS filter:blur (cheaper paint).
 * Matches marketing radial-gradient technique; keep backdrop-filter on cards separately.
 */

const CYAN_GLOW =
  'radial-gradient(ellipse 85% 70% at 50% 100%, rgba(34, 211, 238, 0.22) 0%, rgba(34, 211, 238, 0.09) 38%, transparent 72%)';

const ORANGE_GLOW =
  'radial-gradient(ellipse 85% 70% at 50% 100%, rgba(251, 146, 60, 0.22) 0%, rgba(251, 146, 60, 0.09) 38%, transparent 72%)';

export default function TechboardPageGlow({ tone = 'cyan', className = '' }) {
  const background = tone === 'orange' ? ORANGE_GLOW : CYAN_GLOW;
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[min(560px,120%)] h-[220px] rounded-full ${className}`}
      style={{ background }}
    />
  );
}
