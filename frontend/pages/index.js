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

function resolveDefaultExport(moduleRef) {
  if (!moduleRef) return null;
  return moduleRef.default || moduleRef;
}

const HomePage = HOMEPAGE_SAFARI_PAINT_TEST_ENABLED
  ? resolveDefaultExport(require('../components/marketing/HomepageSafariPaintTest'))
  : resolveDefaultExport(require('../components/marketing/HomepageMarketingPage'));

export default function Home(props) {
  if (!HomePage) {
    throw new Error(
      'Home page component failed to load (check HomepageMarketingPage / HomepageSafariPaintTest export).'
    );
  }
  return <HomePage {...props} />;
}

if (!HOMEPAGE_SAFARI_PAINT_TEST_ENABLED) {
  const HomeLayout = resolveDefaultExport(require('../components/layouts/HomeLayout'));
  Home.getLayout = function getLayout(page) {
    return <HomeLayout>{page}</HomeLayout>;
  };
}
