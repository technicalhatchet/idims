/**
 * Thin `/` entry: build-time branch so Safari paint test does not pull marketing modules.
 *
 * Variant 1 — minimal green baseline (Preview):
 *   NEXT_PUBLIC_HOMEPAGE_SAFARI_PAINT_TEST=1
 *   (do not set NEXT_PUBLIC_HOMEPAGE_PERF_VARIANT)
 *
 * Variants 2–4 — marketing homepage (Preview); see lib/homepagePerfVariant.js:
 *   NEXT_PUBLIC_HOMEPAGE_SAFARI_PAINT_TEST unset
 *   NEXT_PUBLIC_HOMEPAGE_PERF_VARIANT=hero_static | hero_only | full (or unset = full)
 *   NEXT_PUBLIC_HOMEPAGE_PERF_TIMING=1 — timing strip on full homepage (recommended for variant 4)
 *
 * SW isolation (Preview): NEXT_PUBLIC_PWA_OFF=1, NEXT_PUBLIC_HOMEPAGE_UNREGISTER_SW=1
 * Avoid during perf runs: NEXT_PUBLIC_HOMEPAGE_PAINT_DIAG=1, SPLIT_BELOW_FOLD, SPLIT_PROVIDERS, LITE_SHELL
 */

const HOMEPAGE_SAFARI_PAINT_TEST_ENABLED =
  process.env.NEXT_PUBLIC_HOMEPAGE_SAFARI_PAINT_TEST === '1';

let HomePage = null;

export default function Home(props) {
  return <HomePage {...props} />;
}

if (HOMEPAGE_SAFARI_PAINT_TEST_ENABLED) {
  HomePage = require('../components/marketing/HomepageSafariPaintTest').default;
} else {
  HomePage = require('../components/marketing/HomepageMarketingPage').default;
  const HomeLayout = require('../components/layouts/HomeLayout').default;
  Home.getLayout = function getLayout(page) {
    return <HomeLayout>{page}</HomeLayout>;
  };
}
