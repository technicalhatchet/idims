/**
 * Preview-only homepage performance isolation (build-time).
 *
 * Mutually exclusive with NEXT_PUBLIC_HOMEPAGE_SAFARI_PAINT_TEST=1 (minimal green page).
 *
 * NEXT_PUBLIC_HOMEPAGE_PERF_VARIANT:
 *   unset | full     — normal production homepage
 *   hero_static      — real hero + below-fold; hero atom/CTA motion off; homepage
 *                      scroll-reveal opacity/y delays off (see HomepageScrollReveal).
 *                      Below-fold motion.button hover effects remain — they are below the
 *                      initial viewport and do not gate hero first paint.
 *   hero_only        — real hero + HomeLayout; below-fold module not in page graph; animations on
 *   app_shell_probe  — full `_app` providers/chrome; no HomeLayout, hero, or below-fold (cyan probe UI)
 *   layout_shell_probe — full `_app` + real HomeLayout; fuchsia main stub (no hero/below-fold)
 *   layout_shell_no_glow — same probe UI; HomeLayoutDiagnosticNoGlow (no AtomicGlowBackground)
 *
 * Optional timing strip on marketing `/` (all variants including full):
 *   NEXT_PUBLIC_HOMEPAGE_PERF_TIMING=1
 *
 * Recommended Preview pairing (SW isolation): NEXT_PUBLIC_PWA_OFF=1,
 * NEXT_PUBLIC_HOMEPAGE_UNREGISTER_SW=1. Compare second navigation after controller is null.
 *
 * Keep NEXT_PUBLIC_HOMEPAGE_PAINT_DIAG=0 during perf runs (heavier probes).
 * Keep SPLIT_BELOW_FOLD / SPLIT_PROVIDERS / LITE_SHELL off unless testing those separately.
 */

const VALID_VARIANTS = new Set([
  'full',
  'hero_static',
  'hero_only',
  'app_shell_probe',
  'layout_shell_probe',
  'layout_shell_no_glow',
]);

const raw = process.env.NEXT_PUBLIC_HOMEPAGE_PERF_VARIANT || 'full';

export const HOMEPAGE_PERF_VARIANT = VALID_VARIANTS.has(raw) ? raw : 'full';

export const HOMEPAGE_APP_SHELL_PROBE = HOMEPAGE_PERF_VARIANT === 'app_shell_probe';

export const PERF_DISABLE_HERO_ANIMATIONS = HOMEPAGE_PERF_VARIANT === 'hero_static';

export const PERF_INCLUDE_BELOW_FOLD = HOMEPAGE_PERF_VARIANT !== 'hero_only';

export const HOMEPAGE_PERF_TIMING_ENABLED =
  process.env.NEXT_PUBLIC_HOMEPAGE_PERF_TIMING === '1';

export const PERF_SHOW_MEASUREMENT_STRIP =
  HOMEPAGE_PERF_TIMING_ENABLED || HOMEPAGE_PERF_VARIANT !== 'full';

export function getHomepagePerfVariantBannerLabel() {
  if (HOMEPAGE_PERF_VARIANT === 'hero_static') {
    return 'PERF VARIANT: hero_static (hero + reveal delays off; below-fold on, BTF motion kept)';
  }
  if (HOMEPAGE_PERF_VARIANT === 'hero_only') {
    return 'PERF VARIANT: hero_only (hero + layout, below-fold off, animations on)';
  }
  if (HOMEPAGE_PERF_VARIANT === 'app_shell_probe') {
    return 'PERF VARIANT: app_shell_probe (full _app; no HomeLayout/hero/below-fold)';
  }
  if (HOMEPAGE_PERF_VARIANT === 'layout_shell_probe') {
    return 'PERF VARIANT: layout_shell_probe (full _app + HomeLayout; no hero/below-fold)';
  }
  if (HOMEPAGE_PERF_VARIANT === 'layout_shell_no_glow') {
    return 'PERF VARIANT: layout_shell_no_glow (layout shell, no AtomicGlowBackground)';
  }
  if (HOMEPAGE_PERF_TIMING_ENABLED) {
    return 'PERF VARIANT: full (production homepage + timing strip)';
  }
  return '';
}
