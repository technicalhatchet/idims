import { motion } from 'framer-motion';
import { FaPhone, FaComments } from 'react-icons/fa';

export default function SupportCTA() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="relative rounded-2xl overflow-hidden"
    >
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-[#0d1117] to-orange-500/20" />
      <div className="absolute inset-0 border border-white/10 rounded-2xl" />

      <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4 p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <FaPhone className="w-5 h-5 text-cyan-400 -scale-x-100" />
          </div>
          <div>
            <h4 className="text-white font-semibold">Have a question about your repair?</h4>
            <p className="text-gray-400 text-sm">We're here to help!</p>
          </div>
        </div>

        <a href="tel:4197941689">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-3 rounded-xl text-white font-semibold flex items-center gap-2 hover:shadow-[0_0_25px_rgba(251,146,60,0.4)] transition-all"
            style={{ background: 'linear-gradient(135deg, #fb923c 0%, #fbbf24 100%)' }}
          >
            <FaComments className="w-4 h-4" />
            Call Us
          </motion.button>
        </a>
      </div>
    </motion.div>
  );
}
