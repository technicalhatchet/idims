import { MARKETING_GLOW_LAYERS } from '../marketing/marketingGlowLayers';

/** Shared cyan/orange glow for all HomeLayout marketing pages. */
export default function AtomicGlowBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
      style={{
        backgroundImage: MARKETING_GLOW_LAYERS,
        backgroundColor: 'transparent',
      }}
    />
  );
}
