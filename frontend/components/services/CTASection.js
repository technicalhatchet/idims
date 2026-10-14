import Link from 'next/link';
import { motion } from 'framer-motion';
import { MarketingBookLink, MarketingPhoneIcon } from '../marketing/MarketingCta';
import { MARKETING_PHONE_DISPLAY, MARKETING_PHONE_TEL } from '../../constants/marketingSiteContent';

export default function CTASection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="relative py-16 lg:py-20"
    >
      <div className="max-w-6xl mx-auto px-6">
        <div className="relative rounded-3xl overflow-hidden">
          {/* Background Gradients */}
          <div className="absolute inset-0 bg-[#0d1117]" />
          <div className="absolute left-0 top-0 w-1/2 h-full bg-gradient-to-r from-cyan-500/20 to-transparent" />
          <div className="absolute right-0 bottom-0 w-1/2 h-full bg-gradient-to-l from-orange-500/20 to-transparent" />
          
          {/* Lightning Effect */}
          <div className="absolute left-1/4 top-1/2 -translate-y-1/2 w-32 h-32 bg-orange-500/30 blur-3xl" />
          
          {/* Border Glow */}
          <div className="absolute inset-0 rounded-3xl border border-white/10" />

          {/* Content */}
          <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8 p-8 lg:p-12">
            {/* Left - Phone Icon */}
            <div className="hidden lg:flex items-center justify-center w-20 h-20 rounded-full bg-cyan-500/10 border border-cyan-500/30">
              <MarketingPhoneIcon className="w-8 h-8 text-cyan-400" strokeWidth={2} />
            </div>

            {/* Middle - Text */}
            <div className="flex-1 text-center lg:text-left">
              <p className="text-orange-400 text-sm font-semibold tracking-wider uppercase mb-2">
                Ready to Get Started?
              </p>
              <h2 className="text-2xl lg:text-3xl font-bold text-white">
                LET'S GET YOUR APPLIANCE
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-orange-400">
                  WORKING AGAIN.
                </span>
              </h2>
              <p className="text-gray-400 mt-2">
                Fast, reliable service is just a click away.
              </p>
            </div>

            {/* Right - CTA */}
            <div className="flex flex-col items-center gap-3">
              <MarketingBookLink label="Book Your Service" tone="cyan" size="lg" />
              <p className="text-gray-400 text-sm">
                or call{' '}
                <a href={`tel:${MARKETING_PHONE_TEL}`} className="text-orange-400 hover:text-orange-300 font-medium">
                  {MARKETING_PHONE_DISPLAY}
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
