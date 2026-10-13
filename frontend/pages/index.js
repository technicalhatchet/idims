/**
 * Thin `/` entry: build-time branch so Safari paint test and app_shell_probe do not pull marketing modules.
 *
 * Variant 1 — minimal green baseline (Preview):
 *   NEXT_PUBLIC_HOMEPAGE_SAFARI_PAINT_TEST=1
 *   (do not set NEXT_PUBLIC_HOMEPAGE_PERF_VARIANT)
 *
 * Variants 2–5 — see lib/homepagePerfVariant.js:
 *   NEXT_PUBLIC_HOMEPAGE_SAFARI_PAINT_TEST unset
 *   NEXT_PUBLIC_HOMEPAGE_PERF_VARIANT=hero_static | hero_only | full | app_shell_probe
 *   NEXT_PUBLIC_HOMEPAGE_PERF_TIMING=1 — timing strip (recommended for full + app_shell_probe)
 *
 * SW isolation (Preview): NEXT_PUBLIC_PWA_OFF=1, NEXT_PUBLIC_HOMEPAGE_UNREGISTER_SW=1
 * Avoid during perf runs: NEXT_PUBLIC_HOMEPAGE_PAINT_DIAG=1, SPLIT_BELOW_FOLD, SPLIT_PROVIDERS, LITE_SHELL
 */

import { HOMEPAGE_APP_SHELL_PROBE } from '../lib/homepagePerfVariant';

const HOMEPAGE_SAFARI_PAINT_TEST_ENABLED =
  process.env.NEXT_PUBLIC_HOMEPAGE_SAFARI_PAINT_TEST === '1';

function resolvePageComponent(moduleRef) {
  if (!moduleRef) return null;
  return moduleRef.default || moduleRef;
}

/** Build-time: only one branch is bundled per Preview deploy (Next inlines env). */
let PageComponent = null;
let HomeLayoutComponent = null;

if (HOMEPAGE_SAFARI_PAINT_TEST_ENABLED) {
  PageComponent = resolvePageComponent(
    require('../components/marketing/HomepageSafariPaintTest')
  );
} else if (HOMEPAGE_APP_SHELL_PROBE) {
  PageComponent = resolvePageComponent(
    require('../components/marketing/HomepageAppShellProbe')
  );
} else {
  PageComponent = resolvePageComponent(
    require('../components/marketing/HomepageMarketingPage')
  );
  HomeLayoutComponent = resolvePageComponent(require('../components/layouts/HomeLayout'));
}

export default function Home(props) {
  if (!PageComponent) {
    throw new Error('Home page component failed to load for this build configuration.');
  }
  return <PageComponent {...props} />;
}

if (!HOMEPAGE_SAFARI_PAINT_TEST_ENABLED && !HOMEPAGE_APP_SHELL_PROBE && HomeLayoutComponent) {
  Home.getLayout = function getLayout(page) {
    return <HomeLayoutComponent>{page}</HomeLayoutComponent>;
  };
}
