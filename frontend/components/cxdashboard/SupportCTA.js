import { motion } from 'framer-motion';
import { FaPhone, FaComments } from 'react-icons/fa';
import Link from 'next/link';

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
            <FaPhone className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h4 className="text-white font-semibold">Have a question about your repair?</h4>
            <p className="text-gray-400 text-sm">We're here to help!</p>
          </div>
        </div>

        <Link href="/cxdashboard/messages">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold flex items-center gap-2 hover:shadow-[0_0_25px_rgba(249,115,22,0.4)] transition-all"
          >
            <FaComments className="w-4 h-4" />
            Message Us
          </motion.button>
        </Link>
      </div>
    </motion.div>
  );
}
