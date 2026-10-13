import Head from 'next/head';
import HomepagePerfVariantBanner from './HomepagePerfVariantBanner';
import {
  PERF_SHOW_MEASUREMENT_STRIP,
  getHomepagePerfVariantBannerLabel,
} from '../../lib/homepagePerfVariant';

/** ISO time from this SSR pass (static prerender = build time; visible before hydration). */
const SSR_MARKUP_AT = new Date().toISOString();

/**
 * Preview-only: full marketing `_app` path without HomeLayout, hero, or below-fold.
 * Enable via NEXT_PUBLIC_HOMEPAGE_PERF_VARIANT=app_shell_probe (mutually exclusive with SAFARI_PAINT_TEST).
 */
export default function HomepageAppShellProbe() {
  const perfBannerLabel = PERF_SHOW_MEASUREMENT_STRIP
    ? getHomepagePerfVariantBannerLabel()
    : '';

  return (
    <>
      <Head>
        <title>App shell probe | Atomic Repair</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <HomepagePerfVariantBanner label={perfBannerLabel} />

      <main
        id="homepage-app-shell-probe-main"
        className="flex min-h-screen min-h-[100dvh] flex-col items-center justify-center bg-cyan-400 px-6 py-16 text-center"
      >
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
          APP SHELL PROBE
        </h1>
        <p className="mt-4 max-w-lg text-lg font-semibold text-gray-900">
          Full marketing app shell (_app providers + chrome). No HomeLayout, hero, or below-fold.
        </p>
        <p className="mt-6 font-mono text-sm text-gray-800">SSR markup at: {SSR_MARKUP_AT}</p>
      </main>
    </>
  );
}
