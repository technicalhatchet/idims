import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaArrowRight } from 'react-icons/fa';
import AtomicIcon from '../ui/AtomicIcon';

export default function ServiceCard({ service, index }) {
  const detailHref = service.slug 
    ? `/services/${service.slug}` 
    : (service.href || '/book');
  const equipmentType = service.applianceType || service.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group relative"
    >
      <div className="relative h-full p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 hover:border-cyan-500/50 transition-all duration-300 overflow-hidden">
        {/* Hover Glow Effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-orange-500/10" />
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-transparent to-orange-500/20 blur-xl" />
        </div>

        {/* Icon */}
        <div className="relative mb-4">
          <div className="w-20 h-20 relative -ml-2">
            <div className="absolute inset-2 bg-cyan-500/10 rounded-full blur-lg group-hover:bg-cyan-500/20 transition-colors" />
            <AtomicIcon
              equipmentType={equipmentType}
              motion="hover"
              decorative
              className="relative w-20 h-20"
            />
          </div>
        </div>

        {/* Content */}
        <h3 className="relative text-lg font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">
          {service.title}
        </h3>
        <p className="relative text-gray-400 text-sm leading-relaxed mb-4">
          {service.description}
        </p>

        {/* Learn More Link */}
        <Link
          href={detailHref}
          className="relative inline-flex items-center gap-2 text-orange-400 text-sm font-medium hover:text-orange-300 transition-colors group/link"
        >
          Learn More
          <FaArrowRight className="w-3 h-3 group-hover/link:translate-x-1 transition-transform" />
        </Link>
      </div>
    </motion.div>
  );
}
