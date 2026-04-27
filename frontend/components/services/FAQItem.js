import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaMinus } from 'react-icons/fa';

export default function FAQItem({ faq, index }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full p-4 rounded-xl border transition-all duration-300 text-left ${
          isOpen 
            ? 'bg-cyan-500/10 border-cyan-500/30' 
            : 'bg-white/5 border-white/10 hover:border-white/20'
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <span className="text-white font-medium text-sm">{faq.q}</span>
          <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
            isOpen ? 'bg-cyan-500/20' : 'bg-white/10'
          }`}>
            {isOpen ? (
              <FaMinus className="w-3 h-3 text-cyan-400" />
            ) : (
              <FaPlus className="w-3 h-3 text-gray-400" />
            )}
          </div>
        </div>
        
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <p className="pt-3 text-gray-400 text-sm leading-relaxed">
                {faq.a}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </motion.div>
  );
}
