import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  FaShieldAlt, FaBolt, FaCheckCircle, FaDollarSign,
  FaCalendarAlt, FaSearch, FaTools, FaThumbsUp
} from 'react-icons/fa';
import HomeLayout from '../components/layouts/HomeLayout';
import ServiceCard from '../components/services/ServiceCard';
import FeatureBadge from '../components/services/FeatureBadge';
import ProcessStep from '../components/services/ProcessStep';
import CTASection from '../components/services/CTASection';
import { useState } from 'react';

const SERVICES = [
  {
    id: 'refrigerator',
    slug: 'refrigerator-repair',
    title: 'REFRIGERATOR REPAIR',
    description: 'Not cooling, leaking, ice maker issues, and more.',
    icon: '/applianceicons/neon/neonfridge.png'
  },
  {
    id: 'washer',
    slug: 'washer-repair',
    title: 'WASHER REPAIR',
    description: "Won't spin, not draining, noisy or not starting.",
    icon: '/applianceicons/neon/neonwasher.png'
  },
  {
    id: 'dryer',
    slug: 'dryer-repair',
    title: 'DRYER REPAIR',
    description: "Not heating, takes too long, won't start.",
    icon: '/applianceicons/neon/neondryer.png'
  },
  {
    id: 'oven',
    slug: 'oven-repair',
    title: 'OVEN & RANGE REPAIR',
    description: 'Not heating, temperature issues, or not working.',
    icon: '/applianceicons/neon/neonrange.png'
  },
  {
    id: 'dishwasher',
    slug: 'dishwasher-repair',
    title: 'DISHWASHER REPAIR',
    description: 'Not cleaning, leaking, not draining properly.',
    icon: '/applianceicons/neon/neondishwasher.png'
  },
  {
    id: 'microwave',
    slug: 'microwave-repair',
    title: 'MICROWAVE REPAIR',
    description: 'Not heating, turntable issues, or not powering on.',
    icon: '/applianceicons/neon/neonmicrowave.png'
  },
  {
    id: 'freezer',
    slug: 'freezer-repair',
    title: 'FREEZER REPAIR',
    description: 'Not freezing, frost buildup, or unusual noises.',
    icon: '/applianceicons/neon/neonchestfreezer.png'
  },
  {
    id: 'tv',
    slug: 'tv-repair',
    title: 'TV REPAIR',
    description: 'No picture, sound issues, or connectivity problems.',
    icon: '/applianceicons/neon/neonorangecurvedtv.png'
  },
];

const FEATURES = [
  { icon: FaShieldAlt, title: 'Certified Technicians' },
  { icon: FaBolt, title: 'Fast & Reliable' },
  { icon: FaCheckCircle, title: 'Satisfaction Guaranteed' },
  { icon: FaDollarSign, title: 'Upfront Pricing' },
];

const PROCESS_STEPS = [
  {
    icon: FaCalendarAlt,
    title: 'BOOK ONLINE',
    description: 'Choose a time that works for you in under 60 seconds.'
  },
  {
    icon: FaSearch,
    title: 'EXPERT DIAGNOSIS',
    description: 'Our technician arrives on time and diagnoses the issue.'
  },
  {
    icon: FaTools,
    title: 'QUALITY REPAIR',
    description: 'We fix the problem using quality parts and tools.'
  },
  {
    icon: FaThumbsUp,
    title: "YOU'RE GOOD TO GO",
    description: 'Enjoy your fully working appliance with peace of mind.'
  },
];

export default function Services() {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const icons = SERVICES.map(service => service.icon);

  return (
    <>
      <Head>
        <title>Our Services | Atomic Repair</title>
        <meta name="description" content="Expert appliance repair services in Toledo. Refrigerator, washer, dryer, oven, dishwasher, microwave, freezer, and TV repair." />
      </Head>

      {/* Background - Atomic Theme */}
      <div 
        className="fixed inset-0 z-0 overflow-hidden pointer-events-none"
        style={{ backgroundColor: '#000208' }}
      >
        <div 
          className="absolute blur-[120px] md:blur-[180px] w-[300px] h-[300px] md:w-[700px] md:h-[700px] -top-[50px] -left-[100px] md:-top-[100px] md:-left-[200px]"
          style={{ backgroundColor: 'rgba(0, 229, 255, 0.15)' }}
        />
        <div 
          className="absolute blur-[100px] md:blur-[150px] w-[250px] h-[250px] md:w-[500px] md:h-[500px] bottom-[15%] -right-[50px] md:bottom-[20%] md:-right-[100px]"
          style={{ backgroundColor: 'rgba(255, 122, 26, 0.18)' }}
        />
      </div>

      {/* HERO SECTION */}
      <section className="relative pt-28 pb-16 lg:pt-36 lg:pb-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col-reverse lg:flex-row gap-12 lg:gap-8 items-center">
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="lg:flex-1 w-full"
            >
              {/* Label */}
              <p className="text-cyan-400 text-sm font-semibold tracking-wider uppercase mb-4">
                Our Services
              </p>

              {/* Heading */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
                EXPERT REPAIR.
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500 drop-shadow-[0_0_30px_rgba(249,115,22,0.5)]">
                  EVERY TIME.
                </span>
              </h1>

              {/* Subtitle */}
              <p className="mt-6 text-gray-400 text-lg max-w-md leading-relaxed">
                We repair all major appliances quickly and reliably. Quality workmanship, honest pricing, and service you can trust.
              </p>

              {/* Feature Badges */}
              <div className="mt-10 grid grid-cols-4 gap-4 max-w-md">
                {FEATURES.map((feature, index) => (
                  <FeatureBadge key={index} {...feature} index={index} />
                ))}
              </div>

              {/* Mobile CTA */}
              <div className="mt-8 lg:hidden">
                <Link href="/book">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-[0_0_25px_rgba(34,211,238,0.4)] flex items-center justify-center gap-2"
                  >
                    <FaCalendarAlt className="w-4 h-4" />
                    Book Your Service
                  </motion.button>
                </Link>
              </div>
            </motion.div>

            {/* Right - Appliance Image */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative lg:flex-1 w-full"
            >
              {/* Glow Effects */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/30 blur-[100px]" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-64 h-64 bg-orange-500/30 blur-[100px]" />

              {/* Image Container */}
              <div className="relative w-full h-[300px] sm:h-[400px] lg:h-[500px]">
                {!imgError && (
                  <Image
                    src="/images/appliances-hero.png"
                    alt="Appliances we repair"
                    fill
                    className="object-contain"
                    priority
                    onLoad={() => setImgLoaded(true)}
                    onError={() => setImgError(true)}
                  />
                )}

                {/* Only show fallback if image failed or hasn't loaded yet */}
                {(imgError || !imgLoaded) && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="grid grid-cols-3 gap-4">
                      {[...icons].map((icon, i) => (
                        <div key={i} className="w-20 h-20 relative">
                          <Image src={icon} alt="" fill className="object-contain" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* SERVICES GRID SECTION */}
      <section className="relative py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-6">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <p className="text-cyan-400 text-sm font-semibold tracking-wider uppercase mb-3">
              What We Repair
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold text-white">
              OUR REPAIR{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">
                SERVICES
              </span>
            </h2>
          </motion.div>

          {/* Services Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SERVICES.map((service, index) => (
              <ServiceCard key={service.id} service={service} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section className="relative py-20 lg:py-28 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <p className="text-cyan-400 text-sm font-semibold tracking-wider uppercase mb-3">
              Our Process
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold text-white">
              HOW IT{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500">
                WORKS
              </span>
            </h2>
          </motion.div>

          {/* Process Steps */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-4">
            {PROCESS_STEPS.map((step, index) => (
              <ProcessStep
                key={index}
                step={step}
                index={index}
                isLast={index === PROCESS_STEPS.length - 1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <CTASection />
    </>
  );
}

Services.getLayout = function getLayout(page) {
  return <HomeLayout title="Our Services | Quantum Repair">{page}</HomeLayout>;
};
