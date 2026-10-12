import Head from 'next/head';
import Link from 'next/link';
import HomeLayout from '../components/layouts/HomeLayout';
import HomeHeroDiagnosticVisual from '../components/marketing/HomeHeroDiagnosticVisual';
import ScrollReveal from '../components/marketing/ScrollReveal';
import ApplianceIcon from '../components/ui/ApplianceIcon';
import { motion } from 'framer-motion';
import { FaStar, FaShieldAlt, FaClock, FaCheckCircle, FaPhone, FaArrowRight } from 'react-icons/fa';
import { HiLightningBolt } from 'react-icons/hi';
import {
  DIAGNOSTIC_CREDIT_MARKETING,
  OPENING_SPECIAL_LIST_PRICE,
  OPENING_SPECIAL_PRICE,
} from '../constants/bookingMarketing';
const HOMEPAGE_PRICING_VARIANT =
  process.env.NEXT_PUBLIC_HOMEPAGE_PRICING_VARIANT || 'promo';

const HOMEPAGE_PAINT_DIAG_ENABLED =
  process.env.NEXT_PUBLIC_HOMEPAGE_PAINT_DIAG === '1';

let HomepagePaintDiagnostic = null;
let HOMEPAGE_PAINT_DIAG_INLINE_SCRIPT = '';
if (HOMEPAGE_PAINT_DIAG_ENABLED) {
  HomepagePaintDiagnostic = require('../components/marketing/HomepagePaintDiagnostic').default;
  HOMEPAGE_PAINT_DIAG_INLINE_SCRIPT =
    require('../lib/homepagePaintDiagInlineScript').HOMEPAGE_PAINT_DIAG_INLINE_SCRIPT;
}

export default function Home() {
  const services = [
    {
      title: "Refrigerator Repair",
      desc: "Not cooling? Leaking? Making noise? We handle compressors, fans, seals, and more.",
      equipmentType: "refrigerator",
    },
    {
      title: "Range Repair",
      desc: "Not heating or cooking unevenly? We repair igniters, elements, and control boards.",
      equipmentType: "oven",
    },
    {
      title: "Dishwasher Repair",
      desc: "Dishes still dirty? Water not draining? We'll get it running like new again in no time.",
      equipmentType: "dishwasher",
    },
    {
      title: "TV Repair",
      desc: "No picture? Lines on screen? Won't turn on? We diagnose and repair all major TV brands.",
      equipmentType: "tv",
    },
    {
      title: "Washer & Dryer Repair",
      desc: "Won't drain, spin, or heat? We fix all common and complex laundry issues.",
      equipmentType: "washer",
    },
  ];

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

      {/* SERVICES SECTION */}
      <section className="relative pt-14 pb-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-6">
          {/* Section Header */}
          <ScrollReveal className="text-center mb-14">
            <span className="text-cyan-400 text-sm font-semibold tracking-wider uppercase">
              Our Services
            </span>
            <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-white">
              Appliance & TV Repair Services
            </h2>
            <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
              We diagnose and repair all major household appliances and TVs quickly and professionally — fridges, ovens, dishwashers, washers, dryers, and more.
            </p>
          </ScrollReveal>

          {/* Service Cards Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {services.map((service, i) => (
              <ScrollReveal
                key={i}
                delay={i * 0.03}
                whileHover={{ y: -8, transition: { type: 'spring', stiffness: 120, damping: 20, mass: 1.2 } }}
                className="group relative min-w-0"
              >
                <div className="relative p-5 sm:p-6 rounded-2xl bg-[#0D1117] border border-white/5 hover:border-cyan-500/30 transition-all duration-300 h-full">
                  {/* Hover Glow */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-cyan-500/5 to-orange-500/5" />

                  <div className="relative min-w-0">
                    <div className="relative w-16 h-16 mb-4">
                      <div className="absolute inset-0 bg-cyan-500/10 rounded-xl blur-xl group-hover:bg-cyan-500/20 transition-colors" />
                      <div className="relative w-full h-full rounded-xl bg-[#141922] border border-white/5 flex items-center justify-center">
                        <ApplianceIcon
                          equipmentType={service.equipmentType}
                          className="w-11 h-11"
                        />
                      </div>
                    </div>

                    <h3 className="text-base xl:text-lg font-semibold text-white leading-snug mb-3 [text-wrap:balance]">
                      {service.title}
                    </h3>

                    <p className="text-gray-400 text-sm leading-relaxed mb-4">
                      {service.desc}
                    </p>
                    <Link
                      href="/book"
                      prefetch={false}
                      className="inline-flex items-center gap-1 text-orange-400 text-sm font-medium hover:text-orange-300 transition-colors group/link"
                    >
                      Book Now
                      <FaArrowRight className="w-3 h-3 group-hover/link:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING SECTION */}
      <section className="relative py-20 lg:py-28 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <ScrollReveal>
            <span className="text-cyan-400 text-sm font-semibold tracking-wider uppercase">
              Pricing
            </span>
            <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-white">
              Simple, Honest Pricing
            </h2>

            <div className="mt-10 inline-block">
              <div className="relative p-8 lg:p-12 rounded-3xl bg-gradient-to-br from-[#000811] to-[#000208] border border-white/10">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/5 to-orange-500/5" />

                {HOMEPAGE_PRICING_VARIANT === 'promo' ? (
                  <>
                    <span className="relative inline-block mb-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-orange-100 bg-orange-500/20 border border-orange-500/40">
                      Opening Special
                    </span>
                    <div className="relative flex items-end justify-center gap-3">
                      <span className="text-2xl lg:text-3xl text-gray-500 line-through decoration-orange-500/80 decoration-2">
                        ${OPENING_SPECIAL_LIST_PRICE}
                      </span>
                      <p className="text-5xl lg:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500 drop-shadow-[0_0_30px_rgba(249,115,22,0.4)]">
                        ${OPENING_SPECIAL_PRICE}
                      </p>
                    </div>
                    <p className="relative mt-2 text-xl text-white font-semibold">
                      Diagnostic Fee
                    </p>
                    <p className="relative mt-2 text-gray-400 text-sm max-w-sm mx-auto">
                      {DIAGNOSTIC_CREDIT_MARKETING}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="relative text-5xl lg:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500 drop-shadow-[0_0_30px_rgba(249,115,22,0.4)]">
                      ${OPENING_SPECIAL_PRICE}
                    </p>
                    <p className="relative mt-2 text-xl text-white font-semibold">
                      Diagnostic Fee
                    </p>
                    <p className="relative mt-2 text-gray-400">
                      {DIAGNOSTIC_CREDIT_MARKETING}
                    </p>
                  </>
                )}

                <div className="relative mt-8 space-y-3 text-left max-w-xs mx-auto">
                  <div className="flex items-center gap-3 text-gray-300">
                    <FaCheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                    <span>No hidden fees</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-300">
                    <FaCheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                    <span>Upfront pricing</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-300">
                    <FaCheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                    <span>Warranty included</span>
                  </div>
                </div>

                <Link href="/book" prefetch={false} className="relative block mt-8">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 transition-all shadow-[0_0_30px_rgba(34,211,238,0.3)]"
                  >
                    Schedule Appointment
                  </motion.button>
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section className="relative py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <ScrollReveal>
            <h2 className="text-3xl lg:text-4xl font-bold text-white">
              Book Same-Day Diagnostics
            </h2>
            <p className="mt-4 text-gray-400 max-w-lg mx-auto">
              Don't let a broken appliance disrupt your day. Request a diagnostic visit — often same-day when we're available.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/book" prefetch={false}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group px-8 py-4 rounded-lg font-semibold text-white transition-all shadow-[0_0_30px_rgba(251,146,60,0.3)] hover:shadow-[0_0_40px_rgba(251,146,60,0.5)]"
                  style={{ background: 'linear-gradient(135deg, #fb923c 0%, #fbbf24 100%)' }}
                >
                  <span className="flex items-center gap-2">
                    Book Now
                    <FaArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </motion.button>
              </Link>

              <a href="tel:4197400146">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-8 py-4 rounded-lg font-semibold text-white border border-white/20 hover:bg-white/5 transition-colors"
                >
                  <FaPhone className="w-4 h-4" />
                  Call Now
                </motion.button>
              </a>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-6 text-gray-400 text-sm">
              <span className="flex items-center gap-2">
                <FaCheckCircle className="w-4 h-4 text-cyan-400" />
                No commitment
              </span>
              <span className="flex items-center gap-2">
                <FaCheckCircle className="w-4 h-4 text-cyan-400" />
                Fast response
              </span>
              <span className="flex items-center gap-2">
                <FaCheckCircle className="w-4 h-4 text-cyan-400" />
                Trusted service
              </span>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}

Home.getLayout = function getLayout(page) {
  return <HomeLayout>{page}</HomeLayout>;
};
