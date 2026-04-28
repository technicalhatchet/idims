import { motion } from 'framer-motion';
import { FaArrowRight } from 'react-icons/fa';
import Link from 'next/link';

export default function StatCard({ title, value, subtitle, icon: Icon, href, highlight, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Link href={href || '#'}>
        <div className={`group p-5 rounded-2xl border transition-all cursor-pointer ${
          highlight
            ? 'bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/30 hover:border-orange-500/50'
            : 'bg-white/5 border-white/10 hover:border-cyan-500/30'
        }`}>
          <div className="flex items-start justify-between">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              highlight ? 'bg-orange-500/20' : 'bg-cyan-500/10'
            }`}>
              <Icon className={`w-6 h-6 ${highlight ? 'text-orange-400' : 'text-cyan-400'}`} />
            </div>
            <FaArrowRight className="w-4 h-4 text-gray-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
          </div>
          
          <p className="text-gray-400 text-sm mt-4">{title}</p>
          <h3 className={`text-3xl font-bold mt-1 ${highlight ? 'text-orange-400' : 'text-white'}`}>
            {value}
          </h3>
          {subtitle && (
            <p className="text-gray-500 text-xs mt-1">{subtitle}</p>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
