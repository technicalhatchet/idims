import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaShieldAlt, FaClock, FaCheckCircle, FaDollarSign, FaCalendarAlt, FaPhone } from 'react-icons/fa';

const FEATURES = [
  { icon: FaShieldAlt, title: 'Certified Technicians' },
  { icon: FaClock, title: 'Same-Day Service' },
  { icon: FaCheckCircle, title: 'Satisfaction Guaranteed' },
  { icon: FaDollarSign, title: 'Upfront Pricing' },
];

export default function ServiceHero({ service }) {
  return (
    <section className="relative pt-28 pb-16 lg:pt-32 lg:pb-20 overflow-hidden">
      {/* Background Glows */}
      <div className="absolute left-0 top-1/3 w-[500px] h-[500px] bg-cyan-500/20 blur-[150px] -z-10" />
      <div className="absolute right-0 bottom-0 w-[400px] h-[400px] bg-orange-500/15 blur-[120px] -z-10" />

      <div className="max-w-7xl mx-auto px-6">
        {/* Breadcrumb */}
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-sm text-gray-400 mb-8"
        >
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>›</span>
          <Link href="/services" className="hover:text-white transition-colors">Services</Link>
          <span>›</span>
          <span className="text-cyan-400">{service.title}</span>
        </motion.nav>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
              {service.title.split(' ')[0].toUpperCase()}
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500">
                {service.title.split(' ').slice(1).join(' ').toUpperCase() || 'REPAIR'}
              </span>
            </h1>

            <p className="mt-6 text-gray-400 text-lg max-w-md leading-relaxed">
              {service.description}
            </p>

            {/* Feature Badges */}
            <div className="mt-8 grid grid-cols-4 gap-3">
              {FEATURES.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="flex flex-col items-center text-center"
                  >
                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2">
                      <Icon className="w-4 h-4 text-cyan-400" />
                    </div>
                    <span className="text-gray-400 text-[10px] sm:text-xs">{feature.title}</span>
                  </motion.div>
                );
              })}
            </div>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href={`/book?appliance=${service.applianceType}`}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-[0_0_25px_rgba(34,211,238,0.4)] hover:shadow-[0_0_35px_rgba(34,211,238,0.6)] transition-all flex items-center gap-2"
                >
                  <FaCalendarAlt className="w-4 h-4" />
                  Book Your Service
                </motion.button>
              </Link>
              <a href="tel:4195153394" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                <span>or call</span>
                <span className="text-orange-400 font-semibold">(419) 515-3394</span>
              </a>
            </div>
          </motion.div>

          {/* Right - Appliance Image */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="relative flex items-center justify-center">
              {/* Glow Effects */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-48 h-48 bg-cyan-500/30 blur-[80px]" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-48 h-48 bg-orange-500/30 blur-[80px]" />
              
              {/* Image Container */}
              <div className="relative w-full max-w-md h-[300px] lg:h-[400px]">
                <Image
                  src={service.icon}
                  alt={service.title}
                  fill
                  className="object-contain drop-shadow-[0_0_30px_rgba(34,211,238,0.3)]"
                  priority
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
