import Head from 'next/head';
import HomepagePerfVariantBanner from './HomepagePerfVariantBanner';
import {
  PERF_SHOW_MEASUREMENT_STRIP,
  getHomepagePerfVariantBannerLabel,
} from '../../lib/homepagePerfVariant';

/** ISO time from this SSR pass (static prerender = build time; visible before hydration). */
const SSR_MARKUP_AT = new Date().toISOString();

/**
 * Preview-only: rendered inside real HomeLayout (header, footer, glow).
 * Enable via NEXT_PUBLIC_HOMEPAGE_PERF_VARIANT=layout_shell_probe.
 */
export default function HomepageLayoutShellProbe() {
  const perfBannerLabel = PERF_SHOW_MEASUREMENT_STRIP
    ? getHomepagePerfVariantBannerLabel()
    : '';

  return (
    <>
      <Head>
        <title>Layout shell probe | Atomic Repair</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <HomepagePerfVariantBanner label={perfBannerLabel} />

      <section
        id="homepage-layout-shell-probe-main"
        className="flex min-h-[70vh] flex-col items-center justify-center bg-fuchsia-400 px-6 pb-16 pt-32 text-center lg:pt-40"
      >
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
          LAYOUT SHELL PROBE
        </h1>
        <p className="mt-4 max-w-lg text-lg font-semibold text-gray-900">
          Real HomeLayout (header, footer, glow). No HomepageMarketingPage, hero, or below-fold.
        </p>
        <p className="mt-6 font-mono text-sm text-gray-800">SSR markup at: {SSR_MARKUP_AT}</p>
      </section>
    </>
  );
}
