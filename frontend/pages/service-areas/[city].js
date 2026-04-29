import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { 
  FaCheck, FaCheckCircle, FaStar, FaTools, FaMapMarkerAlt, FaClock,
  FaPhone, FaCalendarAlt, FaShieldAlt, FaTruck, FaDollarSign, FaAward,
  FaUsers, FaPlus, FaMinus, FaArrowRight, FaQuoteLeft
} from 'react-icons/fa';
import { useState } from 'react';
import HomeLayout from '../../components/layouts/HomeLayout';
import { 
  serviceAreas, 
  getServiceArea, 
  getAllServiceAreaSlugs, 
  localServices, 
  whyChooseUs 
} from '../../data/serviceAreas';

const WHY_CHOOSE_ICONS = [FaUsers, FaClock, FaTruck, FaDollarSign, FaAward];

function FAQItem({ faq, index }) {
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
        
        {isOpen && (
          <motion.p
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="pt-3 text-gray-400 text-sm leading-relaxed"
          >
            {faq.a}
          </motion.p>
        )}
      </button>
    </motion.div>
  );
}

export default function ServiceAreaPage({ area }) {
  if (!area) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Area Not Found</h1>
          <Link href="/service-area" className="text-cyan-400 hover:underline">
            View All Service Areas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Appliance Repair in {area.name}, {area.state} | Atomic Repair</title>
        <meta 
          name="description" 
          content={`Fast, reliable appliance repair in ${area.name}, ${area.state}. Same-day service available. Licensed & insured local technicians. Call ${area.phone}`} 
        />
        <meta name="keywords" content={`appliance repair ${area.name}, ${area.name} appliance repair, refrigerator repair ${area.name}, washer repair ${area.name}`} />
      </Head>

      {/* Background */}
      <div className="fixed inset-0 -z-50 bg-[#0B0F1A] overflow-hidden">
        <div className="absolute blur-[120px] md:blur-[180px] w-[300px] h-[300px] md:w-[700px] md:h-[700px] -top-[50px] -left-[100px] md:-top-[100px] md:-left-[200px] bg-cyan-500/10" />
        <div className="absolute blur-[100px] md:blur-[150px] w-[250px] h-[250px] md:w-[500px] md:h-[500px] bottom-[15%] -right-[50px] md:bottom-[20%] md:-right-[100px] bg-orange-500/10" />
      </div>

      {/* HERO SECTION */}
      <section className="relative pt-28 pb-16 lg:pt-36 lg:pb-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col-reverse lg:flex-row gap-12 items-center">
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="lg:flex-1 w-full"
            >
              <p className="text-cyan-400 text-sm font-semibold tracking-wider uppercase mb-4">
                Proudly Serving {area.region}
              </p>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
                APPLIANCE REPAIR
                <br />
                IN{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500">
                  {area.name.toUpperCase()}, {area.state}
                </span>
              </h1>

              <p className="mt-6 text-gray-400 text-lg max-w-md leading-relaxed">
                {area.description}
              </p>

              {/* Trust Points */}
              <div className="mt-6 space-y-2">
                {['Licensed & Insured', '5-Star Local Technicians', 'Transparent Pricing'].map((point, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <FaCheckCircle className="w-4 h-4 text-cyan-400" />
                    <span className="text-gray-300 text-sm">{point}</span>
                  </motion.div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/book">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-3 rounded-xl font-semibold text-white shadow-[0_0_25px_rgba(251,146,60,0.4)] hover:shadow-[0_0_35px_rgba(251,146,60,0.6)] transition-all flex items-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #fb923c 0%, #fbbf24 100%)' }}
                  >
                    <FaCalendarAlt className="w-4 h-4" />
                    Book Service
                  </motion.button>
                </Link>
                <a href={`tel:${area.phone.replace(/[^0-9]/g, '')}`}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-3 rounded-xl font-semibold text-white border border-white/20 hover:bg-white/5 transition-all flex items-center gap-2"
                  >
                    <FaPhone className="w-4 h-4" />
                    Call Now
                  </motion.button>
                </a>
              </div>

              {/* Coverage Note */}
              <p className="mt-4 text-gray-500 text-sm flex items-center gap-2">
                <FaMapMarkerAlt className="w-3 h-3" />
                Serving {area.name} and surrounding areas within {area.coverageRadius} miles
              </p>
            </motion.div>

            {/* Right - Appliances / Hero Image */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative lg:flex-1 w-full"
            >
              {/* Toledo: Replace with hero image */}
              {area.slug === 'toledo' && (
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
                  <Image
                    src="/images/toledo-hero.png"
                    alt={`Appliance repair in ${area.name}`}
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              )}

              {/* Maumee: Background accent with icon grid on top */}
              {area.slug === 'maumee' && (
                <div className="relative">
                  {/* Background image with overlay */}
                  <div className="absolute inset-0 rounded-2xl overflow-hidden">
                    <Image
                      src="/images/toledo-hero.png"
                      alt=""
                      fill
                      className="object-cover opacity-30"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F1A] via-[#0B0F1A]/70 to-transparent" />
                  </div>

                  {/* Icon grid on top */}
                  <div className="relative grid grid-cols-3 gap-4 max-w-md mx-auto p-6">
                    {[
                      '/applianceicons/neon/neonfridge.png',
                      '/applianceicons/neon/neonwasher.png',
                      '/applianceicons/neon/neonrange.png',
                      '/applianceicons/neon/neondishwasher.png',
                      '/applianceicons/neon/neonmicrowave.png',
                      '/applianceicons/neon/neonorangecurvedtv.png'
                    ].map((icon, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 + i * 0.1 }}
                        className="aspect-square relative flex items-center justify-center p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20"
                      >
                        <Image src={icon} alt="" width={50} height={50} className="object-contain" />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Other cities: Default icon grid */}
              {area.slug !== 'toledo' && area.slug !== 'maumee' && (
                <>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-48 h-48 bg-cyan-500/20 blur-[80px]" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-48 h-48 bg-orange-500/20 blur-[80px]" />

                  <div className="relative grid grid-cols-3 gap-4 max-w-md mx-auto">
                    {[
                      '/applianceicons/neon/neonfridge.png',
                      '/applianceicons/neon/neonwasher.png',
                      '/applianceicons/neon/neonrange.png',
                      '/applianceicons/neon/neondishwasher.png',
                      '/applianceicons/neon/neonmicrowave.png',
                      '/applianceicons/neon/neonorangecurvedtv.png'
                    ].map((icon, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 + i * 0.1 }}
                        className="aspect-square relative flex items-center justify-center p-4 rounded-xl bg-white/5 border border-white/10"
                      >
                        <Image src={icon} alt="" width={50} height={50} className="object-contain" />
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="relative py-8 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: FaStar, value: area.stats.rating, label: 'Google Rating' },
              { icon: FaTools, value: `${area.stats.repairsCompleted.toLocaleString()}+`, label: 'Repairs Completed' },
              { icon: FaMapMarkerAlt, value: 'Locally', label: 'Owned & Operated' },
              { icon: FaClock, value: 'Same-Day', label: 'Availability' }
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white font-bold">{stat.value}</p>
                    <p className="text-gray-500 text-xs">{stat.label}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* AREAS WE SERVE */}
      <section className="relative py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <p className="text-cyan-400 text-sm font-semibold tracking-wider uppercase mb-3">
              Areas We Serve
            </p>
            <h2 className="text-2xl lg:text-3xl font-bold text-white">
              Proudly Serving {area.name} & Surrounding Areas
            </h2>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-3">
            {area.nearbyCities.map((city, i) => (
              <motion.div
                key={city.slug}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/service-areas/${city.slug}`}>
                  <div className={`px-5 py-2.5 rounded-full border transition-all cursor-pointer ${
                    city.slug === area.slug
                      ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:border-cyan-500/30 hover:text-white'
                  }`}>
                    <span className="font-medium text-sm">{city.name}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-6"
          >
            <Link href="/service-area" className="text-orange-400 text-sm font-medium hover:text-orange-300 inline-flex items-center gap-2">
              View All Service Areas
              <FaArrowRight className="w-3 h-3" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* SERVICES IN THIS AREA */}
      <section className="relative py-16 lg:py-20 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-cyan-400 text-sm font-semibold tracking-wider uppercase mb-3">
              Appliance Repair Services
            </p>
            <h2 className="text-2xl lg:text-3xl font-bold text-white">
              We Repair All Major Appliances
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {localServices.map((service, i) => (
              <motion.div
                key={service.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group"
              >
                <Link href={`/services/${service.slug}`}>
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all h-full">
                    <div className="w-14 h-14 relative mb-4">
                      <Image src={service.icon} alt={service.title} fill className="object-contain" />
                    </div>
                    <h3 className="text-white font-semibold text-sm mb-2 group-hover:text-cyan-400 transition-colors">
                      {service.title}
                    </h3>
                    <p className="text-gray-400 text-xs leading-relaxed mb-3">
                      {service.description}
                    </p>
                    <span className="text-orange-400 text-xs font-medium inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                      Learn More
                      <FaArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="relative py-16 lg:py-20 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-cyan-400 text-sm font-semibold tracking-wider uppercase mb-3">
              Why Choose Atomic Repair in {area.name}?
            </p>
            <h2 className="text-2xl lg:text-3xl font-bold text-white">
              Local Service You Can Count On
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {whyChooseUs.map((item, i) => {
              const Icon = WHY_CHOOSE_ICONS[i] || FaCheckCircle;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all text-center"
                >
                  <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto mb-3">
                    <Icon className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h4 className="text-white font-semibold text-sm mb-2">{item.title}</h4>
                  <p className="text-gray-400 text-xs leading-relaxed">{item.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      {area.testimonials && area.testimonials.length > 0 && (
        <section className="relative py-16 lg:py-20 border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <p className="text-cyan-400 text-sm font-semibold tracking-wider uppercase mb-3">
                What Your Neighbors Are Saying
              </p>
              <h2 className="text-2xl lg:text-3xl font-bold text-white">
                Real Service. Real Customers.
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {area.testimonials.map((testimonial, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10"
                >
                  <div className="flex gap-1 mb-3">
                    {[...Array(testimonial.rating)].map((_, j) => (
                      <FaStar key={j} className="w-4 h-4 text-orange-400" />
                    ))}
                  </div>
                  <FaQuoteLeft className="w-6 h-6 text-cyan-500/30 mb-2" />
                  <p className="text-gray-300 text-sm leading-relaxed mb-4">
                    "{testimonial.text}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-orange-500/20 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {testimonial.author.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{testimonial.author}</p>
                      <p className="text-gray-500 text-xs">{testimonial.location}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* MAP SECTION */}
      <section className="relative py-16 lg:py-20 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* Map Placeholder */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative h-[300px] lg:h-[350px] rounded-2xl overflow-hidden bg-gradient-to-br from-cyan-500/10 to-orange-500/10 border border-white/10"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <FaMapMarkerAlt className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
                  <p className="text-white font-semibold">{area.name}, {area.state}</p>
                  <p className="text-gray-400 text-sm">Coverage Area</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {area.nearbyCities.slice(0, 5).map((city, i) => (
                      <span key={i} className="px-2 py-1 rounded bg-white/10 text-gray-300 text-xs">
                        {city.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-cyan-400 text-sm font-semibold tracking-wider uppercase mb-3">
                Our Service Area
              </p>
              <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4">
                We Cover {area.coverageRadius} Miles Around {area.name}
              </h2>
              <p className="text-gray-400 mb-6">
                Not sure if you're in our area? Call or text us – we're happy to help!
              </p>

              <div className="flex flex-wrap gap-4">
                <a href={`tel:${area.phone.replace(/[^0-9]/g, '')}`}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-3 rounded-xl font-semibold text-white shadow-[0_0_25px_rgba(251,146,60,0.4)] flex items-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #fb923c 0%, #fbbf24 100%)' }}
                  >
                    <FaPhone className="w-4 h-4" />
                    {area.phone}
                  </motion.button>
                </a>
                <Link href="/book">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-3 rounded-xl font-semibold text-white border border-white/20 hover:bg-white/5 transition-all flex items-center gap-2"
                  >
                    <FaCalendarAlt className="w-4 h-4" />
                    Book Online
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      {area.faqs && area.faqs.length > 0 && (
        <section className="relative py-16 lg:py-20 border-t border-white/5">
          <div className="max-w-4xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <p className="text-cyan-400 text-sm font-semibold tracking-wider uppercase mb-3">
                FAQ
              </p>
              <h2 className="text-2xl lg:text-3xl font-bold text-white">
                Frequently Asked Questions
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-4">
              {area.faqs.map((faq, i) => (
                <FAQItem key={i} faq={faq} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FINAL CTA */}
      <section className="relative py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 via-[#0d1117] to-cyan-500/20" />
            <div className="absolute inset-0 rounded-3xl border border-white/10" />

            <div className="relative flex flex-col lg:flex-row items-center justify-between gap-6 p-8 lg:p-10">
              <div className="flex items-center gap-4">
                <div className="hidden lg:flex w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/30 items-center justify-center">
                  <FaPhone className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-xl lg:text-2xl font-bold text-white">
                    Need Appliance Repair in {area.name}?
                  </h3>
                  <p className="text-gray-400 text-sm">We'll get it fixed fast.</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <Link href="/book">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-[0_0_25px_rgba(34,211,238,0.4)] flex items-center gap-2"
                  >
                    <FaCalendarAlt className="w-4 h-4" />
                    Book Service Now
                  </motion.button>
                </Link>
                <a href={`tel:${area.phone.replace(/[^0-9]/g, '')}`}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-3 rounded-xl font-semibold text-orange-400 border border-orange-500/50 hover:bg-orange-500/10 transition-all flex items-center gap-2"
                  >
                    <FaPhone className="w-4 h-4" />
                    Call {area.phone}
                  </motion.button>
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}

export async function getStaticPaths() {
  const slugs = getAllServiceAreaSlugs();
  const paths = slugs.map((city) => ({
    params: { city }
  }));

  return {
    paths,
    fallback: false
  };
}

export async function getStaticProps({ params }) {
  const area = getServiceArea(params.city);

  if (!area) {
    return {
      notFound: true
    };
  }

  return {
    props: {
      area
    }
  };
}

ServiceAreaPage.getLayout = function getLayout(page) {
  return <HomeLayout>{page}</HomeLayout>;
};
