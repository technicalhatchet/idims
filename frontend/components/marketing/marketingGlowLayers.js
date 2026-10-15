/**
 * GPU-friendly cyan/orange atmosphere — radial gradients only (no filter: blur).
 * Used by HomeLayout and optional per-page overlays (e.g. book vignette).
 */
export const MARKETING_GLOW_LAYERS = [
  'radial-gradient(ellipse 90% 60% at 8% 6%, rgba(0, 229, 255, 0.2) 0%, transparent 58%)',
  'radial-gradient(ellipse 75% 55% at 92% 78%, rgba(255, 122, 26, 0.22) 0%, transparent 55%)',
  'radial-gradient(ellipse 50% 40% at 50% 100%, rgba(0, 229, 255, 0.06) 0%, transparent 70%)',
].join(', ');

/** Soft hero halo behind large AtomicIcon — gradient only. */
export const MARKETING_ICON_HALO_STYLE = {
  background:
    'radial-gradient(circle at 50% 50%, rgba(0, 229, 255, 0.14) 0%, rgba(255, 122, 26, 0.08) 45%, transparent 70%)',
};
