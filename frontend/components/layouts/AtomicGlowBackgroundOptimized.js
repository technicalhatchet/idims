/**
 * Lightweight marketing glow — same cyan/orange placement as AtomicGlowBackground without
 * large DOM nodes + CSS filter blur (Safari compositing cost). Preview / A/B candidate.
 */
const OPTIMIZED_GLOW_LAYERS = [
  'radial-gradient(ellipse 90% 60% at 8% 6%, rgba(0, 229, 255, 0.2) 0%, transparent 58%)',
  'radial-gradient(ellipse 75% 55% at 92% 78%, rgba(255, 122, 26, 0.22) 0%, transparent 55%)',
  'radial-gradient(ellipse 50% 40% at 50% 100%, rgba(0, 229, 255, 0.06) 0%, transparent 70%)',
].join(', ');

export default function AtomicGlowBackgroundOptimized() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
      style={{
        backgroundImage: OPTIMIZED_GLOW_LAYERS,
        backgroundColor: 'transparent',
      }}
    />
  );
}
