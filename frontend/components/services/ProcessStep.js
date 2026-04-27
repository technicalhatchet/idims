import { motion } from 'framer-motion';

export default function ProcessStep({ step, index, isLast }) {
  const Icon = step.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
      className="relative flex flex-col items-center text-center"
    >
      {/* Connecting Line */}
      {!isLast && (
        <div className="hidden md:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-0.5">
          <div className="w-full h-full bg-gradient-to-r from-cyan-500/30 to-orange-500/30" />
          <motion.div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-500 to-orange-500"
            initial={{ width: '0%' }}
            whileInView={{ width: '100%' }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: index * 0.2 + 0.3 }}
          />
        </div>
      )}

      {/* Step Circle */}
      <div className="relative mb-4">
        {/* Outer Glow */}
        <div className="absolute inset-0 w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/30 to-orange-500/30 blur-lg" />
        
        {/* Circle */}
        <div className="relative w-16 h-16 rounded-full bg-[#0d1117] border-2 border-cyan-500/50 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.3)]">
          <Icon className="w-6 h-6 text-cyan-400" />
        </div>

        {/* Step Number */}
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold shadow-[0_0_10px_rgba(249,115,22,0.5)]">
          {index + 1}
        </div>
      </div>

      {/* Title */}
      <h4 className="text-white font-semibold mb-1">{step.title}</h4>

      {/* Description */}
      <p className="text-gray-400 text-sm max-w-[150px]">{step.description}</p>
    </motion.div>
  );
}
