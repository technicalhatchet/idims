import { motion } from 'framer-motion';
import { FaCheckCircle } from 'react-icons/fa';
import { OUR_PROMISE } from '../../constants/marketingSiteContent';

export default function OurPromiseSection({ cityName }) {
  const subtitle = cityName
    ? `How we work in ${cityName}`
    : 'How we work';

  return (
    <section className="relative py-16 lg:py-20 border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <p className="text-cyan-400 text-sm font-semibold tracking-wider uppercase mb-3">
            {subtitle}
          </p>
          <h2 className="text-2xl lg:text-3xl font-bold text-white">
            {OUR_PROMISE.title}
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto p-8 rounded-2xl bg-white/5 border border-white/10 text-center"
        >
          <p className="text-gray-300 text-sm leading-relaxed">{OUR_PROMISE.body}</p>
          <ul className="mt-8 space-y-3 text-left max-w-md mx-auto">
            {OUR_PROMISE.bullets.map((line) => (
              <li key={line} className="flex items-start gap-3 text-gray-300 text-sm">
                <FaCheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
