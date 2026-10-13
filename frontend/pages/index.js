import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import HomeLayout from '../components/layouts/HomeLayout';
import HomeHeroDiagnosticVisual from '../components/marketing/HomeHeroDiagnosticVisual';
import { motion } from 'framer-motion';
import { FaStar, FaClock, FaPhone, FaArrowRight } from 'react-icons/fa';
import { HiLightningBolt } from 'react-icons/hi';
import HomepageBelowFoldSections from '../components/marketing/HomepageBelowFoldSections';

/**
 * Preview: code-split below-the-fold homepage sections off the initial pages/index chunk.
 * Build-time flag — set NEXT_PUBLIC_HOMEPAGE_SPLIT_BELOW_FOLD=1 on Preview only.
 */
const HOMEPAGE_SPLIT_BELOW_FOLD_ENABLED =
  process.env.NEXT_PUBLIC_HOMEPAGE_SPLIT_BELOW_FOLD === '1';

const HomepageBelowFoldDynamic = HOMEPAGE_SPLIT_BELOW_FOLD_ENABLED
  ? dynamic(() => import('../components/marketing/HomepageBelowFoldSections'), {
      ssr: true,
    })
  : null;

const HOMEPAGE_PAINT_DIAG_ENABLED =
  process.env.NEXT_PUBLIC_HOMEPAGE_PAINT_DIAG === '1';

let HomepagePaintDiagnostic = null;
let HOMEPAGE_PAINT_DIAG_INLINE_SCRIPT = '';
if (HOMEPAGE_PAINT_DIAG_ENABLED) {
  HomepagePaintDiagnostic = require('../components/marketing/HomepagePaintDiagnostic').default;
  HOMEPAGE_PAINT_DIAG_INLINE_SCRIPT =
    require('../lib/homepagePaintDiagInlineScript').HOMEPAGE_PAINT_DIAG_INLINE_SCRIPT;
}

function HomepageBelowFold() {
  if (HOMEPAGE_SPLIT_BELOW_FOLD_ENABLED) {
    const Lazy = HomepageBelowFoldDynamic;
    return <Lazy />;
  }
  return <HomepageBelowFoldSections />;
}

export default function Home() {
  return (
    <>
      <Head>
        <title>Atomic Repair | Fast, Reliable Appliance Repair in Toledo</title>
        <meta name="description" content="Same-day appliance diagnostics when available in Toledo. Honest assessments, upfront pricing, and expert technicians." />
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

      {/* HERO SECTION */}
      <section
        {...(HOMEPAGE_PAINT_DIAG_ENABLED
          ? { id: 'homepage-paint-diag-main' }
          : {})}
        className="relative pt-32 pb-10 lg:pt-40 lg:pb-28 overflow-hidden"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-y-6 gap-x-8 lg:gap-y-8 items-center">
            
            {/* Copy + CTAs + trust (always first on mobile) */}
            <div className="relative z-10 row-start-1 col-start-1">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 mb-6">
                <HiLightningBolt className="w-4 h-4 text-cyan-400" />
                <span className="text-cyan-400 text-sm font-medium" style={{ textShadow: '0 0 4px rgba(249,115,22,1), 0 0 10px rgba(249,115,22,0.9), 0 0 20px rgba(249,115,22,0.5)' }}>Same-Day Diagnostics Available</span>
              </div>

              {/* Heading */}
              <h1
                {...(HOMEPAGE_PAINT_DIAG_ENABLED
                  ? { id: 'homepage-paint-diag-hero-h1' }
                  : {})}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight"
              >
                Fast, Reliable
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300 drop-shadow-[0_0_25px_rgba(34,211,238,0.5)]">
                  Appliance Repair
                </span>
                <br />
                in Toledo
              </h1>

              {/* Subtext */}
              <p className="mt-6 text-lg text-gray-400 max-w-md">
                Same-day diagnostics when available. Honest assessments. No surprises.
              </p>

              {/* CTA Buttons — mobile: full-width stack, call first; sm+: book then call */}
              <div className="mt-8 flex w-full max-w-md flex-col gap-4 sm:max-w-none sm:flex-row sm:flex-wrap">
                <a href="tel:4197400146" className="order-1 w-full sm:order-2 sm:w-auto">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex w-full items-center justify-center gap-2 px-8 py-4 rounded-lg font-semibold text-white border border-white/20 hover:bg-white/5 transition-colors sm:w-auto"
                  >
                    <FaPhone className="w-4 h-4" />
                    Call Now
                  </motion.button>
                </a>

                <Link href="/book" prefetch={false} className="order-2 w-full sm:order-1 sm:w-auto">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="group relative w-full overflow-hidden rounded-lg px-8 py-4 font-semibold text-white sm:w-auto"
                  >
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #fb923c 0%, #fbbf24 100%)' }} />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #fcd34d 100%)' }} />
                    <span className="relative flex items-center justify-center gap-2">
                      Book Service Now
                      <FaArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </motion.button>
                </Link>
              </div>

              {/* Trust Indicators */}
              <div className="mt-8 flex flex-wrap gap-6 lg:mt-10 lg:gap-10">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-500/20">
                    <FaStar className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">4.9 Rated</p>
                    <p className="text-gray-500 text-sm">100+ Reviews</p>
                  </div>
                </div>

                {/* Licensed & insured — restore when credentials are finalized
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500/20">
                    <FaShieldAlt className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Licensed & Insured</p>
                    <p className="text-gray-500 text-sm">Your home is protected</p>
                  </div>
                </div>
                */}

                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-500/20">
                    <FaClock className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Same-Day Diagnostics</p>
                    <p className="text-gray-500 text-sm">When slots are available</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Atom visual — below trust on mobile; right column on lg+ */}
            <div className="row-start-2 col-start-1 flex flex-col items-center lg:row-start-1 lg:col-start-2 -mt-1 lg:mt-0">
              <HomeHeroDiagnosticVisual />
              <p className="mt-3 max-w-xs text-center text-sm text-gray-400 lg:hidden">
                Expert technicians — thorough diagnosis before any repair.
              </p>
            </div>
          </div>
        </div>
      </section>

      <HomepageBelowFold />
    </>
  );
}

Home.getLayout = function getLayout(page) {
  return <HomeLayout>{page}</HomeLayout>;
};
