import Head from 'next/head';
import dynamic from 'next/dynamic';
import HomeLayout from '../layouts/HomeLayout';
import HomepageMarketingHero from './HomepageMarketingHero';
import HomepagePerfVariantBanner from './HomepagePerfVariantBanner';
import {
  PERF_DISABLE_HERO_ANIMATIONS,
  PERF_INCLUDE_BELOW_FOLD,
  PERF_SHOW_MEASUREMENT_STRIP,
  getHomepagePerfVariantBannerLabel,
} from '../../lib/homepagePerfVariant';

/**
 * Preview: code-split below-the-fold homepage sections off the initial pages/index chunk.
 * Build-time flag — set NEXT_PUBLIC_HOMEPAGE_SPLIT_BELOW_FOLD=1 on Preview only.
 */
const HOMEPAGE_SPLIT_BELOW_FOLD_ENABLED =
  process.env.NEXT_PUBLIC_HOMEPAGE_SPLIT_BELOW_FOLD === '1';

/**
 * Below-fold module is omitted from this file's graph when NEXT_PUBLIC_HOMEPAGE_PERF_VARIANT=hero_only
 * (build-time require/dynamic only when PERF_INCLUDE_BELOW_FOLD).
 */
let HomepageBelowFoldSections = null;
let HomepageBelowFoldDynamic = null;

if (PERF_INCLUDE_BELOW_FOLD) {
  if (HOMEPAGE_SPLIT_BELOW_FOLD_ENABLED) {
    HomepageBelowFoldDynamic = dynamic(() => import('./HomepageBelowFoldSections'), {
      ssr: true,
    });
  } else {
    HomepageBelowFoldSections = require('./HomepageBelowFoldSections').default;
  }
}

const HOMEPAGE_PAINT_DIAG_ENABLED =
  process.env.NEXT_PUBLIC_HOMEPAGE_PAINT_DIAG === '1';

let HomepagePaintDiagnostic = null;
let HOMEPAGE_PAINT_DIAG_INLINE_SCRIPT = '';
if (HOMEPAGE_PAINT_DIAG_ENABLED) {
  HomepagePaintDiagnostic = require('./HomepagePaintDiagnostic').default;
  HOMEPAGE_PAINT_DIAG_INLINE_SCRIPT =
    require('../../lib/homepagePaintDiagInlineScript').HOMEPAGE_PAINT_DIAG_INLINE_SCRIPT;
}

function HomepageBelowFold() {
  if (!PERF_INCLUDE_BELOW_FOLD) {
    return null;
  }
  if (HOMEPAGE_SPLIT_BELOW_FOLD_ENABLED) {
    const Lazy = HomepageBelowFoldDynamic;
    return <Lazy />;
  }
  const Sections = HomepageBelowFoldSections;
  return <Sections />;
}

export default function MarketingHome() {
  const perfBannerLabel = PERF_SHOW_MEASUREMENT_STRIP
    ? getHomepagePerfVariantBannerLabel()
    : '';
  const usePaintDiagIds = HOMEPAGE_PAINT_DIAG_ENABLED;

  return (
    <>
      <Head>
        <title>Atomic Repair | Fast, Reliable Appliance Repair in Toledo</title>
        <meta
          name="description"
          content="Same-day appliance diagnostics when available in Toledo. Honest assessments, upfront pricing, and expert technicians."
        />
        <link rel="manifest" href="/manifest.json" />
        {HOMEPAGE_PAINT_DIAG_ENABLED ? (
          <script
            dangerouslySetInnerHTML={{ __html: HOMEPAGE_PAINT_DIAG_INLINE_SCRIPT }}
          />
        ) : null}
      </Head>

      {HOMEPAGE_PAINT_DIAG_ENABLED && HomepagePaintDiagnostic ? (
        <HomepagePaintDiagnostic />
      ) : null}

      <HomepagePerfVariantBanner label={perfBannerLabel} />

      <HomepageMarketingHero
        disableHeroAnimations={PERF_DISABLE_HERO_ANIMATIONS}
        heroSectionId={usePaintDiagIds ? 'homepage-paint-diag-main' : undefined}
        heroHeadingId={usePaintDiagIds ? 'homepage-paint-diag-hero-h1' : undefined}
      />

      <HomepageBelowFold />
    </>
  );
}

MarketingHome.getLayout = function getLayout(page) {
  return <HomeLayout>{page}</HomeLayout>;
};
