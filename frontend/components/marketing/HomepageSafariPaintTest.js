import Head from 'next/head';

/**
 * Preview-only minimal homepage (build-time gate).
 *
 * Enable on Preview build (mutually exclusive with NEXT_PUBLIC_HOMEPAGE_PERF_VARIANT):
 *   NEXT_PUBLIC_HOMEPAGE_SAFARI_PAINT_TEST=1
 *
 * Service worker isolation (same Preview):
 *   NEXT_PUBLIC_PWA_OFF=1 — disables next-pwa registration in this build
 *   NEXT_PUBLIC_HOMEPAGE_UNREGISTER_SW=1 — unregisters workers on `/` after mount
 *
 * SW timing: unregister runs in useEffect (after first paint). A previously installed
 * worker may still control the first navigation. Use the second load in the same session
 * (after sessionStorage marks unregister done) and confirm navigator.serviceWorker.controller
 * is null before treating the run as SW-free.
 *
 * Optional nav timing line (non-blocking, no React):
 *   NEXT_PUBLIC_HOMEPAGE_SAFARI_PAINT_TIMING=1 (default off)
 *
 * Do not enable NEXT_PUBLIC_HOMEPAGE_PAINT_DIAG on this route — use homepageMarketing.js.
 * Keep split/lite homepage flags OFF so `/` stays on this page.
 */

const HOMEPAGE_SAFARI_PAINT_TIMING_ENABLED =
  process.env.NEXT_PUBLIC_HOMEPAGE_SAFARI_PAINT_TIMING === '1';

/** ISO time from this SSR pass (static prerender = build time; still visible before hydration). */
const SSR_MARKUP_AT = new Date().toISOString();

const INLINE_NAV_TIMING_SCRIPT = `(function(){try{var el=document.getElementById('safari-paint-test-nav');if(!el)return;var parts=[];if(typeof performance!=='undefined'){if(performance.timeOrigin)parts.push('timeOrigin '+Math.round(performance.timeOrigin)+' ms');parts.push('now '+Math.round(performance.now())+' ms');}el.textContent=parts.join(' · ')||'timing unavailable';}catch(e){}})();`;

export default function HomepageSafariPaintTest() {
  return (
    <>
      <Head>
        <title>Safari paint test | Atomic Repair</title>
        <meta name="robots" content="noindex,nofollow" />
        <style>{`
          html, body { margin: 0; padding: 0; height: 100%; }
          #homepage-paint-diag-main {
            min-height: 100vh;
            min-height: 100dvh;
            box-sizing: border-box;
            padding: 24px;
            background: #0a3d0a;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            font-size: 28px;
            line-height: 1.35;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 16px;
          }
          #homepage-paint-diag-main h1 {
            margin: 0;
            font-size: 40px;
            font-weight: 800;
            letter-spacing: 0.04em;
          }
          #homepage-paint-diag-main p { margin: 0; font-size: 18px; opacity: 0.95; }
        `}</style>
      </Head>

      <div id="homepage-paint-diag-main">
        <h1 id="homepage-paint-diag-hero-h1">SAFARI PAINT TEST</h1>
        <p>SSR markup at: {SSR_MARKUP_AT}</p>
        {HOMEPAGE_SAFARI_PAINT_TIMING_ENABLED ? (
          <>
            <p id="safari-paint-test-nav">Navigation timing: (inline script)…</p>
            <script
              dangerouslySetInnerHTML={{ __html: INLINE_NAV_TIMING_SCRIPT }}
            />
          </>
        ) : null}
      </div>
    </>
  );
}
