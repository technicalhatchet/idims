import Head from 'next/head';
import Link from 'next/link';
import HomeLayout from '../components/layouts/HomeLayout';
import HomeHeroDiagnosticVisual from '../components/marketing/HomeHeroDiagnosticVisual';
import ScrollReveal from '../components/marketing/ScrollReveal';
import ApplianceIcon from '../components/ui/ApplianceIcon';
import AtomicIcon from '../components/ui/AtomicIcon';
import { motion } from 'framer-motion';
import { FaClock, FaCheckCircle, FaArrowRight, FaDollarSign } from 'react-icons/fa';
import { MARKETING_SERVICES } from '../constants/marketingSiteContent';
import { MarketingBookLink, MarketingCallLink } from '../components/marketing/MarketingCta';
import OurPromiseSection from '../components/marketing/OurPromiseSection';
import { HiLightningBolt } from 'react-icons/hi';
import {
  DIAGNOSTIC_CREDIT_MARKETING,
  OPENING_SPECIAL_LIST_PRICE,
  OPENING_SPECIAL_PRICE,
} from '../constants/bookingMarketing';

const HOMEPAGE_PRICING_VARIANT =
  process.env.NEXT_PUBLIC_HOMEPAGE_PRICING_VARIANT || 'promo';

export default function Home() {
  const services = MARKETING_SERVICES;

  return (
    <>
      <Head>
        <title>Atomic Repair | Fast, Reliable Appliance Repair in Toledo</title>
        <meta name="description" content="Same-day appliance diagnostics when available in Toledo. Honest assessments and upfront pricing." />
        <link rel="manifest" href="/manifest.json" />
      </Head>

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-10 lg:pt-40 lg:pb-28 overflow-hidden">
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
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
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

              {/* CTA — mobile: book top, call bottom; desktop: call left, book right */}
              <div className="mt-8 flex w-full max-w-md flex-col gap-4 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-stretch">
                <div className="order-1 w-full sm:order-2 sm:w-auto">
                  <MarketingBookLink label="Book Service Now" tone="cyan" size="lg" fullWidth className="sm:!w-auto" />
                </div>
                <div className="order-2 w-full sm:order-1 sm:w-auto">
                  <MarketingCallLink label="Call Now" tone="orange" size="lg" fullWidth className="sm:!w-auto" />
                </div>
              </div>

              {/* Trust Indicators */}
              <div className="mt-8 flex flex-wrap gap-6 lg:mt-10 lg:gap-10">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500/20">
                    <FaDollarSign className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">${OPENING_SPECIAL_PRICE} diagnostic</p>
                    <p className="text-gray-500 text-sm">50% credit toward repair</p>
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

            {/* Atom visual — below trust on mobile; right column on lg+ */}
            <div className="row-start-2 col-start-1 flex flex-col items-center lg:row-start-1 lg:col-start-2 -mt-1 lg:mt-0">
              <HomeHeroDiagnosticVisual />
              <p className="mt-3 max-w-xs text-center text-sm text-gray-400 lg:hidden">
                Diagnostic-first — we quote before additional repair work.
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

          {/* Mobile: compact rows */}
          <div className="md:hidden space-y-3">
            {services.map((service, i) => (
              <Link
                key={service.slug}
                href={`/services/${service.slug}`}
                prefetch={false}
                className="flex items-center gap-4 p-4 rounded-xl bg-[#0D1117] border border-white/5 active:bg-white/5"
              >
                <ApplianceIcon equipmentType={service.equipmentType} className="w-10 h-10 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-white font-medium text-sm">{service.title}</p>
                  <p className="text-gray-500 text-xs line-clamp-2">{service.description}</p>
                </div>
                <FaArrowRight
                  className={`w-4 h-4 flex-shrink-0 ${i % 2 === 0 ? 'text-cyan-400' : 'text-orange-400'}`}
                />
              </Link>
            ))}
          </div>

          {/* Desktop: service cards */}
          <div className="hidden md:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {services.map((service, i) => {
              const accentCyan = i % 2 === 0;
              return (
              <ScrollReveal
                key={service.slug}
                delay={i * 0.03}
                whileHover={{ y: -8, transition: { type: 'spring', stiffness: 120, damping: 20, mass: 1.2 } }}
                className="group relative min-w-0"
              >
                <div
                  className={`relative p-5 sm:p-6 rounded-2xl bg-[#0D1117] border border-white/5 transition-all duration-300 h-full ${
                    accentCyan ? 'hover:border-cyan-500/30' : 'hover:border-orange-500/30'
                  }`}
                >
                  <div
                    className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br ${
                      accentCyan ? 'from-cyan-500/5 to-transparent' : 'from-orange-500/5 to-transparent'
                    }`}
                  />

                  <div className="relative min-w-0">
                    <div className="relative w-20 h-20 mb-3 -ml-2">
                      <div
                        className={`absolute inset-2 rounded-full blur-xl transition-colors ${
                          accentCyan
                            ? 'bg-cyan-500/10 group-hover:bg-cyan-500/20'
                            : 'bg-orange-500/10 group-hover:bg-orange-500/20'
                        }`}
                      />
                      <AtomicIcon
                        equipmentType={service.equipmentType}
                        motion="hover"
                        decorative
                        className="relative w-20 h-20"
                      />
                    </div>

                    <h3 className="text-base xl:text-lg font-semibold text-white leading-snug mb-3 [text-wrap:balance]">
                      {service.title}
                    </h3>

                    <p className="text-gray-400 text-sm leading-relaxed mb-4">
                      {service.description}
                    </p>
                    <Link
                      href={`/services/${service.slug}`}
                      prefetch={false}
                      className={`inline-flex items-center gap-1 text-sm font-medium transition-colors group/link ${
                        accentCyan
                          ? 'text-cyan-400 hover:text-cyan-300'
                          : 'text-orange-400 hover:text-orange-300'
                      }`}
                    >
                      Learn more
                      <FaArrowRight className="w-3 h-3 group-hover/link:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              </ScrollReveal>
            );
            })}
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

                <div className="relative mt-8">
                  <MarketingBookLink
                    label="Schedule Appointment"
                    tone="cyan"
                    size="lg"
                    fullWidth
                    className="!rounded-xl"
                  />
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <OurPromiseSection />

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

            <div className="mt-8 flex flex-col sm:flex-row flex-wrap justify-center items-stretch gap-4 max-w-md sm:max-w-none mx-auto">
              <div className="order-1 sm:order-2 w-full sm:w-auto">
                <MarketingBookLink label="Book Now" tone="cyan" size="lg" fullWidth />
              </div>
              <div className="order-2 sm:order-1 w-full sm:w-auto">
                <MarketingCallLink label="Call Now" tone="orange" size="lg" fullWidth />
              </div>
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
