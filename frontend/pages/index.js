/**
 * Thin `/` entry — delegates to lib/homepage/resolveHomepageEntry.js (one entry module per build).
 *
 * Variant 1 — minimal green baseline (Preview):
 *   NEXT_PUBLIC_HOMEPAGE_SAFARI_PAINT_TEST=1
 *   (do not set NEXT_PUBLIC_HOMEPAGE_PERF_VARIANT)
 *
 * Variants 2–6 — see lib/homepagePerfVariant.js:
 *   NEXT_PUBLIC_HOMEPAGE_SAFARI_PAINT_TEST unset
 *   NEXT_PUBLIC_HOMEPAGE_PERF_VARIANT=hero_static | hero_only | full | app_shell_probe | layout_shell_probe
 *   NEXT_PUBLIC_HOMEPAGE_PERF_TIMING=1 — timing strip (recommended for probes + full)
 *
 * SW isolation (Preview): NEXT_PUBLIC_PWA_OFF=1, NEXT_PUBLIC_HOMEPAGE_UNREGISTER_SW=1
 * Avoid during perf runs: NEXT_PUBLIC_HOMEPAGE_PAINT_DIAG=1, SPLIT_BELOW_FOLD, SPLIT_PROVIDERS, LITE_SHELL
 */

import Home, { homeGetLayout } from '../lib/homepage/resolveHomepageEntry';

export default Home;

if (homeGetLayout) {
  Home.getLayout = homeGetLayout;
}
