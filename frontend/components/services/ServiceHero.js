import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaShieldAlt, FaClock, FaCheckCircle, FaDollarSign } from 'react-icons/fa';
import AtomicIcon from '../ui/AtomicIcon';
import { MarketingBookLink } from '../marketing/MarketingCta';
import { MARKETING_ICON_HALO_STYLE } from '../marketing/marketingGlowLayers';
import { MARKETING_PHONE_DISPLAY, MARKETING_PHONE_TEL } from '../../constants/marketingSiteContent';

const FEATURES = [
  { icon: FaClock, title: 'Same-day when available' },
  { icon: FaCheckCircle, title: '90-day warranty' },
  { icon: FaDollarSign, title: 'Upfront pricing' },
  { icon: FaShieldAlt, title: 'Diagnostic-first' },
];

export default function ServiceHero({ service }) {
  return (
    <section className="relative pt-28 pb-16 lg:pt-32 lg:pb-20 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Breadcrumb */}
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-sm text-gray-400 mb-8"
        >
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>›</span>
          <Link href="/services" className="hover:text-white transition-colors">Services</Link>
          <span>›</span>
          <span className="text-cyan-400">{service.title}</span>
        </motion.nav>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
                {service.title.split(' ')[0].toUpperCase()}
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500">
                  {service.title.split(' ').slice(1).join(' ').toUpperCase() || 'REPAIR'}
                </span>
              </h1>
              {/* Mobile/tablet: icon sits beside the headline so it's above the fold */}
              <AtomicIcon
                equipmentType={service.applianceType}
                motion="always"
                decorative
                priority
                className="lg:hidden w-32 h-32 sm:w-40 sm:h-40 -mr-3 shrink-0"
              />
            </div>

            <p className="mt-6 text-gray-400 text-lg max-w-md leading-relaxed">
              {service.description}
            </p>

            {/* Feature Badges */}
            <div className="mt-8 grid grid-cols-4 gap-3">
              {FEATURES.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="flex flex-col items-center text-center"
                  >
                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2">
                      <Icon className="w-4 h-4 text-cyan-400" />
                    </div>
                    <span className="text-gray-400 text-[10px] sm:text-xs">{feature.title}</span>
                  </motion.div>
                );
              })}
            </div>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-4">
              <div className="order-1 sm:order-2">
                <MarketingBookLink
                  href={`/book?appliance=${service.applianceType}`}
                  label="Book Your Service"
                  tone="cyan"
                  size="md"
                />
              </div>
              <a
                href={`tel:${MARKETING_PHONE_TEL}`}
                className="order-2 sm:order-1 flex items-center justify-center sm:justify-start gap-2 text-gray-400 hover:text-white transition-colors text-sm py-3"
              >
                <span>or call</span>
                <span className="text-orange-400 font-semibold">{MARKETING_PHONE_DISPLAY}</span>
              </a>
            </div>
          </motion.div>

          {/* Right - big animated neon appliance (desktop) */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative flex flex-col items-center justify-center">
              <div
                className="pointer-events-none absolute inset-0 m-auto w-80 h-80 rounded-full"
                style={MARKETING_ICON_HALO_STYLE}
                aria-hidden
              />
              <AtomicIcon
                equipmentType={service.applianceType}
                motion="always"
                decorative
                priority
                className="relative w-80 h-80 xl:w-96 xl:h-96"
              />
              {/* Soft reflection, like neon on a wet floor */}
              <div
                aria-hidden="true"
                className="relative -mt-14 h-24 w-80 xl:w-96 overflow-hidden opacity-20 blur-[1.5px] [transform:scaleY(-1)] [mask-image:linear-gradient(to_top,#000,transparent_70%)]"
              >
                <AtomicIcon
                  equipmentType={service.applianceType}
                  decorative
                  className="absolute bottom-0 left-0 w-80 h-80 xl:w-96 xl:h-96"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
