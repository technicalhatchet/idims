import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useUser } from '@auth0/nextjs-auth0/client';
import HomeLayout from '../components/layouts/HomeLayout';
import { motion } from 'framer-motion';
import { FaStar, FaShieldAlt, FaClock, FaCheckCircle, FaPhone, FaArrowRight } from 'react-icons/fa';
import { HiLightningBolt } from 'react-icons/hi';

export default function Home() {
  const { user } = useUser();

  const services = [
    {
      title: "Refrigerator Repair",
      desc: "Not cooling? Leaking? Making noise? We handle compressors, fans, seals, and more.",
      icon: "/applianceicons/neon/neonfridge.png"
    },
    {
      title: "Oven & Range Repair",
      desc: "Not heating or cooking unevenly? We repair igniters, elements, and control boards.",
      icon: "/applianceicons/neon/neonrange.png"
    },
    {
      title: "Dishwasher Repair",
      desc: "Dishes still dirty? Water not draining? We'll get it running like new again.",
      icon: "/applianceicons/neon/neondishwasher.png"
    },
    {
      title: "TV Repair",
      desc: "No picture? Lines on screen? Won't turn on? We diagnose and repair all major TV brands.",
      icon: "/applianceicons/neon/neonorangecurvedtv.png"
    },
    {
      title: "Washer & Dryer Repair",
      desc: "Won't drain, spin, or heat? We fix all common and complex laundry issues.",
      icon: "/applianceicons/neon/neonwasher.png"
    },
  ];

  const fadeUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.6 },
    viewport: { once: true }
  };

  return (
    <>
      <Head>
        <title>Atomic Repair | Fast, Reliable Appliance Repair in Toledo</title>
        <meta name="description" content="Same-day appliance repair service in Toledo. Honest diagnostics, no surprises. Licensed & insured technicians." />
      </Head>

      {/* Background Gradients */}
      <div className="fixed inset-0 -z-50 bg-[#0B0F1A] overflow-hidden">
        <div className="absolute w-[800px] h-[800px] bg-cyan-500/15 blur-[180px] top-[-200px] left-[-200px]" />
        <div className="absolute w-[600px] h-[600px] bg-orange-500/10 blur-[150px] bottom-[-100px] right-[-100px]" />
      </div>

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="relative z-10"
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/20 border border-orange-500/30 mb-6">
                <HiLightningBolt className="w-4 h-4 text-orange-400" />
                <span className="text-orange-400 text-sm font-medium">Same-Day Service Available</span>
              </div>

              {/* Heading */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
                Fast, Reliable
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300 drop-shadow-[0_0_25px_rgba(34,211,238,0.5)]">
                  Appliance Repair
                </span>
                <br />
                in Toledo
              </h1>

              {/* Subtext */}
              <p className="mt-6 text-lg text-gray-400 max-w-md">
                Same-day service. Honest diagnostics. No surprises.
              </p>

              {/* CTA Buttons */}
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/book">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="group relative px-8 py-4 rounded-lg font-semibold text-white overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-orange-600" />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-orange-400 to-orange-500" />
                    <span className="relative flex items-center gap-2">
                      Book Service Now
                      <FaArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </motion.button>
                </Link>

                <a href="tel:4190000000">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-8 py-4 rounded-lg font-semibold text-white border border-white/20 hover:bg-white/5 transition-colors"
                  >
                    <FaPhone className="w-4 h-4" />
                    Call Now
                  </motion.button>
                </a>
              </div>

              {/* Trust Indicators */}
              <div className="mt-10 flex flex-wrap gap-6 lg:gap-10">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-500/20">
                    <FaStar className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">4.9 Rated</p>
                    <p className="text-gray-500 text-sm">100+ Reviews</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500/20">
                    <FaShieldAlt className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Licensed & Insured</p>
                    <p className="text-gray-500 text-sm">Your home is protected</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-500/20">
                    <FaClock className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Same-Day Service</p>
                    <p className="text-gray-500 text-sm">When available</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Visual */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              {/* Neon Ring Effect */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[400px] h-[400px] lg:w-[500px] lg:h-[500px] rounded-full border-2 border-cyan-500/30 shadow-[0_0_60px_rgba(34,211,238,0.3),inset_0_0_60px_rgba(34,211,238,0.1)]" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[350px] h-[350px] lg:w-[450px] lg:h-[450px] rounded-full border border-orange-500/20 shadow-[0_0_40px_rgba(249,115,22,0.2)]" />
              </div>

              {/* Main Image Container */}
              <div className="relative z-10 flex items-center justify-center min-h-[400px] lg:min-h-[500px]">
                <div className="relative w-[300px] h-[350px] lg:w-[380px] lg:h-[450px] rounded-2xl overflow-hidden bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-white/10">
                  {/* Placeholder for technician image */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-orange-500/20 flex items-center justify-center">
                        <span className="text-4xl">🔧</span>
                      </div>
                      <p className="text-gray-500 text-sm">Technician Image</p>
                    </div>
                  </div>
                </div>

                {/* Expert Technicians Badge */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                  className="absolute right-0 top-1/4 lg:right-[-20px]"
                >
                  <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-[#0B0F1A]/90 backdrop-blur-md border border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/20">
                      <FaCheckCircle className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">Expert Technicians</p>
                      <p className="text-gray-400 text-xs">We fix it right the first time.</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* SERVICES SECTION */}
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
            <span className="text-cyan-400 text-sm font-semibold tracking-wider uppercase">
              Our Services
            </span>
            <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-white">
              Appliance & TV Repair Services
            </h2>
            <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
              We diagnose and repair all major household appliances and TVs quickly and professionally — fridges, ovens, dishwashers, washers, dryers, and more.
            </p>
          </motion.div>

          {/* Service Cards Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {services.map((service, i) => (
              <motion.div
                key={i}
                {...fadeUp}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                whileHover={{ y: -8, transition: { type: 'spring', stiffness: 120, damping: 20, mass: 1.2 } }}
                className="group relative"
              >
                <div className="relative p-6 rounded-2xl bg-[#0D1117] border border-white/5 hover:border-cyan-500/30 transition-all duration-300 h-full">
                  {/* Hover Glow */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-cyan-500/5 to-orange-500/5" />

                  {/* Icon + Content */}
                  <div className="relative">
                    {/* Icon + Title same line */}
                    <div className="flex items-center gap-4 mb-3">
                      <div className="relative flex-shrink-0 w-20 h-20">
                        <div className="absolute inset-0 bg-cyan-500/10 rounded-xl blur-xl group-hover:bg-cyan-500/20 transition-colors" />
                        <div className="relative w-full h-full rounded-xl bg-[#141922] border border-white/5 flex items-center justify-center overflow-hidden">
                          <Image
                            src={service.icon}
                            alt={service.title}
                            width={52}
                            height={52}
                            className="object-contain"
                          />
                        </div>
                      </div>
                      <h3 className="relative text-lg font-semibold text-white">
                        {service.title}
                      </h3>
                    </div>
                    {/* Description below */}
                    <p className="relative text-gray-400 text-sm leading-relaxed mb-4">
                      {service.desc}
                    </p>
                    <Link
                      href="/book"
                      className="relative inline-flex items-center gap-1 text-orange-400 text-sm font-medium hover:text-orange-300 transition-colors group/link"
                    >
                      Book Now
                      <FaArrowRight className="w-3 h-3 group-hover/link:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING SECTION */}
      <section className="relative py-20 lg:py-28 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-cyan-400 text-sm font-semibold tracking-wider uppercase">
              Pricing
            </span>
            <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-white">
              Simple, Honest Pricing
            </h2>

            <div className="mt-10 inline-block">
              <div className="relative p-8 lg:p-12 rounded-3xl bg-gradient-to-br from-[#0D1117] to-[#0B0F1A] border border-white/10">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/5 to-orange-500/5" />
                
                <p className="relative text-5xl lg:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500 drop-shadow-[0_0_30px_rgba(249,115,22,0.4)]">
                  $89
                </p>
                <p className="relative mt-2 text-xl text-white font-semibold">
                  Diagnostic Fee
                </p>
                <p className="relative mt-2 text-gray-400">
                  Waived if you proceed with the repair
                </p>

                <div className="relative mt-8 space-y-3 text-left max-w-xs mx-auto">
                  <div className="flex items-center gap-3 text-gray-300">
                    <FaCheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                    <span>No hidden fees</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-300">
                    <FaCheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                    <span>Upfront pricing</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-300">
                    <FaCheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                    <span>Warranty included</span>
                  </div>
                </div>

                <Link href="/book" className="relative block mt-8">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 transition-all shadow-[0_0_30px_rgba(34,211,238,0.3)]"
                  >
                    Schedule Appointment
                  </motion.button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section className="relative py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-white">
              Get Your Appliance Fixed Today
            </h2>
            <p className="mt-4 text-gray-400 max-w-lg mx-auto">
              Don't let a broken appliance disrupt your day. Our expert technicians are ready to help.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/book">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group px-8 py-4 rounded-lg font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 transition-all shadow-[0_0_30px_rgba(249,115,22,0.3)]"
                >
                  <span className="flex items-center gap-2">
                    Book Now
                    <FaArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </motion.button>
              </Link>

              <a href="tel:4190000000">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-8 py-4 rounded-lg font-semibold text-white border border-white/20 hover:bg-white/5 transition-colors"
                >
                  <FaPhone className="w-4 h-4" />
                  Call Now
                </motion.button>
              </a>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-6 text-gray-400 text-sm">
              <span className="flex items-center gap-2">
                <FaCheckCircle className="w-4 h-4 text-cyan-400" />
                No commitment
              </span>
              <span className="flex items-center gap-2">
                <FaCheckCircle className="w-4 h-4 text-cyan-400" />
                Fast response
              </span>
              <span className="flex items-center gap-2">
                <FaCheckCircle className="w-4 h-4 text-cyan-400" />
                Trusted service
              </span>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}

Home.getLayout = function getLayout(page) {
  return <HomeLayout>{page}</HomeLayout>;
};
