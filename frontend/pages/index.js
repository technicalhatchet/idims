/**
 * Thin `/` entry — lib/homepage/resolveHomepageEntry.js + @idims/homepage-entry (next.config alias).
 *
 * Variant 1 — minimal green baseline (Preview):
 *   NEXT_PUBLIC_HOMEPAGE_SAFARI_PAINT_TEST=1
 *   (do not set NEXT_PUBLIC_HOMEPAGE_PERF_VARIANT)
 *
 * Variants 2–9 — see lib/homepagePerfVariant.js:
 *   NEXT_PUBLIC_HOMEPAGE_SAFARI_PAINT_TEST unset
 *   NEXT_PUBLIC_HOMEPAGE_PERF_VARIANT=hero_static | hero_only | full | app_shell_probe | layout_shell_probe | layout_shell_no_glow | layout_shell_optimized_glow | marketing_optimized_glow
 *   NEXT_PUBLIC_HOMEPAGE_PERF_TIMING=1 — timing strip (recommended for probes + full)
 *
 * SW isolation (Preview): NEXT_PUBLIC_PWA_OFF=1, NEXT_PUBLIC_HOMEPAGE_UNREGISTER_SW=1
 * Avoid during perf runs: NEXT_PUBLIC_HOMEPAGE_PAINT_DIAG=1, SPLIT_BELOW_FOLD, SPLIT_PROVIDERS, LITE_SHELL
 */

import HomepageEntryPage, { homeGetLayout } from '../lib/homepage/resolveHomepageEntry';

/** Pages Router requires a component defined on the page module (not a bare re-export). */
export default function Home(props) {
  return <HomepageEntryPage {...props} />;
}

if (homeGetLayout) {
  Home.getLayout = homeGetLayout;
}
