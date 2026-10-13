import Link from 'next/link';
import HomeHeroDiagnosticVisual from './HomeHeroDiagnosticVisual';
import { motion } from 'framer-motion';
import { FaStar, FaClock, FaPhone, FaArrowRight } from 'react-icons/fa';
import { HiLightningBolt } from 'react-icons/hi';

const buttonClassCall =
  'flex w-full items-center justify-center gap-2 px-8 py-4 rounded-lg font-semibold text-white border border-white/20 hover:bg-white/5 transition-colors sm:w-auto';
const buttonClassBook =
  'group relative w-full overflow-hidden rounded-lg px-8 py-4 font-semibold text-white sm:w-auto';

function HeroCtaButtons({ disableHeroAnimations }) {
  if (disableHeroAnimations) {
    return (
      <>
        <a href="tel:4197400146" className="order-1 w-full sm:order-2 sm:w-auto">
          <button type="button" className={buttonClassCall}>
            <FaPhone className="w-4 h-4" />
            Call Now
          </button>
        </a>
        <Link href="/book" prefetch={false} className="order-2 w-full sm:order-1 sm:w-auto">
          <button type="button" className={buttonClassBook}>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #fb923c 0%, #fbbf24 100%)' }} />
            <span className="relative flex items-center justify-center gap-2">
              Book Service Now
              <FaArrowRight className="w-4 h-4" />
            </span>
          </button>
        </Link>
      </>
    );
  }

  return (
    <>
      <a href="tel:4197400146" className="order-1 w-full sm:order-2 sm:w-auto">
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={buttonClassCall}
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
          className={buttonClassBook}
        >
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #fb923c 0%, #fbbf24 100%)' }} />
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #fcd34d 100%)' }}
          />
          <span className="relative flex items-center justify-center gap-2">
            Book Service Now
            <FaArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </span>
        </motion.button>
      </Link>
    </>
  );
}

export default function HomepageMarketingHero({
  disableHeroAnimations = false,
  heroSectionId,
  heroHeadingId,
}) {
  return (
    <section
      {...(heroSectionId ? { id: heroSectionId } : {})}
      className="relative pt-32 pb-10 lg:pt-40 lg:pb-28 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-y-6 gap-x-8 lg:gap-y-8 items-center">
          <div className="relative z-10 row-start-1 col-start-1">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 mb-6">
              <HiLightningBolt className="w-4 h-4 text-cyan-400" />
              <span
                className="text-cyan-400 text-sm font-medium"
                style={{
                  textShadow:
                    '0 0 4px rgba(249,115,22,1), 0 0 10px rgba(249,115,22,0.9), 0 0 20px rgba(249,115,22,0.5)',
                }}
              >
                Same-Day Diagnostics Available
              </span>
            </div>

            <h1
              {...(heroHeadingId ? { id: heroHeadingId } : {})}
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

            <p className="mt-6 text-lg text-gray-400 max-w-md">
              Same-day diagnostics when available. Honest assessments. No surprises.
            </p>

            <div className="mt-8 flex w-full max-w-md flex-col gap-4 sm:max-w-none sm:flex-row sm:flex-wrap">
              <HeroCtaButtons disableHeroAnimations={disableHeroAnimations} />
            </div>

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

          <div className="row-start-2 col-start-1 flex flex-col items-center lg:row-start-1 lg:col-start-2 -mt-1 lg:mt-0">
            <HomeHeroDiagnosticVisual disableAnimations={disableHeroAnimations} />
            <p className="mt-3 max-w-xs text-center text-sm text-gray-400 lg:hidden">
              Expert technicians — thorough diagnosis before any repair.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
