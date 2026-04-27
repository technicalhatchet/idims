import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaArrowRight } from 'react-icons/fa';

export default function ServiceCard({ service, index }) {
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
          <div className="w-16 h-16 relative">
            <div className="absolute inset-0 bg-cyan-500/10 rounded-xl blur-lg group-hover:bg-cyan-500/20 transition-colors" />
            <div className="relative w-full h-full rounded-xl bg-[#0d1117] border border-white/10 flex items-center justify-center overflow-hidden">
              <Image
                src={service.icon}
                alt={service.title}
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
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
          href={service.href || '/book'}
          className="relative inline-flex items-center gap-2 text-orange-400 text-sm font-medium hover:text-orange-300 transition-colors group/link"
        >
          Learn More
          <FaArrowRight className="w-3 h-3 group-hover/link:translate-x-1 transition-transform" />
        </Link>
      </div>
    </motion.div>
  );
}
