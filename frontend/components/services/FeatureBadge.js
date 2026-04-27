import { motion } from 'framer-motion';

export default function FeatureBadge({ icon: Icon, title, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
      className="flex flex-col items-center text-center"
    >
      <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2 group hover:border-cyan-500/50 transition-all">
        <Icon className="w-5 h-5 text-cyan-400" />
      </div>
      <span className="text-gray-300 text-xs font-medium">{title}</span>
    </motion.div>
  );
}
