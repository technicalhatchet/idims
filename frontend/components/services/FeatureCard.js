import { motion } from 'framer-motion';

export default function FeatureCard({ feature, index }) {
  const Icon = feature.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group relative"
    >
      <div className="h-full p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 hover:border-cyan-500/30 transition-all duration-300 text-center">
        {/* Hover Glow */}
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-cyan-500/5 to-orange-500/5" />
        
        {/* Icon */}
        <div className="relative mx-auto w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-4 group-hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all">
          <Icon className="w-6 h-6 text-cyan-400" />
        </div>
        
        {/* Title */}
        <h4 className="relative text-white font-bold text-sm uppercase tracking-wide mb-2">
          {feature.title}
        </h4>
        
        {/* Description */}
        <p className="relative text-gray-400 text-sm leading-relaxed">
          {feature.description}
        </p>
      </div>
    </motion.div>
  );
}
