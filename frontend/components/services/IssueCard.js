import { motion } from 'framer-motion';
import { FaExclamationCircle } from 'react-icons/fa';

export default function IssueCard({ issue, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="group relative"
    >
      <div className="p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-cyan-500/30 transition-all duration-300">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
            <FaExclamationCircle className="w-4 h-4 text-cyan-400" />
          </div>
          
          {/* Content */}
          <div>
            <h4 className="text-white font-semibold text-sm">{issue.title}</h4>
            <p className="text-gray-400 text-xs mt-1">{issue.description}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
