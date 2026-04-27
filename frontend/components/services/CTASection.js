import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaPhone, FaCalendarAlt } from 'react-icons/fa';

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
              <FaPhone className="w-8 h-8 text-cyan-400" />
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
              <Link href="/book">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:shadow-[0_0_40px_rgba(34,211,238,0.6)] transition-all flex items-center gap-2"
                >
                  <FaCalendarAlt className="w-4 h-4" />
                  Book Your Service
                </motion.button>
              </Link>
              <p className="text-gray-400 text-sm">
                or call{' '}
                <a href="tel:4195551234" className="text-orange-400 hover:text-orange-300 font-medium">
                  (419) 555-1234
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
