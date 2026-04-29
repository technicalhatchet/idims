import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { FaMapMarkerAlt, FaPhone, FaCalendarAlt, FaArrowRight, FaPalette } from 'react-icons/fa';
import HomeLayout from '../components/layouts/HomeLayout';
import { allCities, serviceAreas } from '../data/serviceAreas';

const THEMES = {
  original: {
    name: 'Original',
    bg: '#0B0F1A',
    card: 'bg-white/5 border-white/10',
    cardHover: 'hover:border-cyan-500/50',
    showGlows: true,
  },
  atomic: {
    name: 'Atomic',
    bg: '#000208',
    card: 'bg-[#000811] border-[#1A2A3A]',
    cardHover: 'hover:border-[#00E5FF]',
    showGlows: true,
  },
};

// Midnight theme accent colors
const MIDNIGHT_ACCENTS = {
  // Primary brand
  electricCyan: '#00E5FF',
  deepNeonBlue: '#0A84FF',
  atomicOrange: '#FF7A1A',
  brightOrange: '#FF9A3D',
  // Cool depth
  cardBorder: '#1A2A3A',
  cardBorderHover: '#22384D',
  // Glow softeners
  cyanGlow: 'rgba(0, 229, 255, 0.25)',
  orangeGlow: 'rgba(255, 122, 26, 0.25)',
  // Text hierarchy
  textPrimary: '#EAF6FF',
  textSecondary: '#9FB3C8',
  textMuted: '#6B7C8F',
  // Interactive
  tealHighlight: '#00C2B8',
};

export default function ServiceAreaIndex() {
  const mainArea = serviceAreas.toledo;
  const [theme, setTheme] = useState('atomic');
  const t = THEMES[theme];

  return (
    <>
      <Head>
        <title>Service Areas | Quantum Repair - Appliance Repair in Toledo & NW Ohio</title>
        <meta 
          name="description" 
          content="Quantum Repair serves Toledo, OH and surrounding areas including Sylvania, Maumee, Perrysburg, and more. Same-day appliance repair available." 
        />
      </Head>

      {/* Background - inline style to override HomeLayout's bg */}
      <div 
        className="fixed inset-0 z-0 overflow-hidden pointer-events-none"
        style={{ 
          backgroundColor: t.bg,
          transition: 'background-color 500ms ease'
        }}
      >
        {t.showGlows && (
          <>
            <div 
              className="absolute blur-[120px] md:blur-[180px] w-[300px] h-[300px] md:w-[700px] md:h-[700px] -top-[50px] -left-[100px] md:-top-[100px] md:-left-[200px] transition-all duration-500"
              style={{ 
                backgroundColor: theme === 'atomic' 
                  ? 'rgba(0, 229, 255, 0.15)' 
                  : 'rgba(6, 182, 212, 0.1)' 
              }}
            />
            <div 
              className="absolute blur-[100px] md:blur-[150px] w-[250px] h-[250px] md:w-[500px] md:h-[500px] bottom-[15%] -right-[50px] md:bottom-[20%] md:-right-[100px] transition-all duration-500"
              style={{ 
                backgroundColor: theme === 'atomic' 
                  ? 'rgba(255, 122, 26, 0.18)' 
                  : 'rgba(249, 115, 22, 0.1)' 
              }}
            />
          </>
        )}
      </div>

      {/* Theme Selector */}
      <div className="fixed top-24 right-6 z-50">
        <div 
          className="flex items-center gap-2 p-2 rounded-xl backdrop-blur-md border transition-all duration-500"
          style={{
            backgroundColor: theme === 'atomic' ? 'rgba(0, 8, 17, 0.8)' : 'rgba(255,255,255,0.1)',
            borderColor: theme === 'atomic' ? '#1A2A3A' : 'rgba(255,255,255,0.1)'
          }}
        >
          <FaPalette className="w-4 h-4" style={{ color: theme === 'atomic' ? '#9FB3C8' : '#9ca3af' }} />
          {Object.entries(THEMES).map(([key, value]) => (
            <button
              key={key}
              onClick={() => setTheme(key)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: theme === key 
                  ? (theme === 'atomic' ? '#00E5FF' : '#06b6d4')
                  : 'transparent',
                color: theme === key 
                  ? (theme === 'atomic' ? '#000208' : 'white')
                  : (theme === 'atomic' ? '#9FB3C8' : '#9ca3af'),
                boxShadow: theme === key && theme === 'atomic' 
                  ? '0 0 15px rgba(0, 229, 255, 0.4)' 
                  : 'none'
              }}
            >
              {value.name}
            </button>
          ))}
        </div>
      </div>

      {/* HERO */}
      <section className="relative pt-28 pb-16 lg:pt-32 lg:pb-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col-reverse lg:flex-row gap-12 items-center">
            {/* Left - Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:flex-1"
            >
              <p 
                className="text-sm font-semibold tracking-wider uppercase mb-4 transition-colors duration-500"
                style={{ color: theme === 'atomic' ? '#00E5FF' : '#22d3ee' }}
              >
                Our Service Areas
              </p>
              <h1 
                className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight transition-colors duration-500"
                style={{ color: theme === 'atomic' ? '#EAF6FF' : 'white' }}
              >
                APPLIANCE REPAIR IN
                <br />
                <span 
                  className="text-transparent bg-clip-text"
                  style={{ 
                    backgroundImage: theme === 'atomic' 
                      ? 'linear-gradient(to right, #FF7A1A, #FF9A3D)' 
                      : 'linear-gradient(135deg, #fb923c, #fbbf24)' 
                  }}
                >
                  TOLEDO & NW OHIO
                </span>
              </h1>
              <p 
                className="mt-6 text-lg transition-colors duration-500"
                style={{ color: theme === 'atomic' ? '#9FB3C8' : '#9ca3af' }}
              >
                We proudly serve Toledo and the surrounding communities with fast, reliable appliance repair. Same-day service available.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/book">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all duration-300"
                    style={{
                      background: theme === 'atomic' 
                        ? 'linear-gradient(135deg, #00E5FF, #0A84FF)' 
                        : 'linear-gradient(to right, #06b6d4, #0891b2)',
                      color: theme === 'atomic' ? '#000208' : 'white',
                      boxShadow: theme === 'atomic' 
                        ? '0 0 25px rgba(0, 229, 255, 0.4)' 
                        : '0 0 25px rgba(34,211,238,0.4)'
                    }}
                  >
                    <FaCalendarAlt className="w-4 h-4" />
                    Book Service
                  </motion.button>
                </Link>
                <a href="tel:4195551234">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all duration-300"
                    style={{
                      backgroundColor: 'transparent',
                      borderWidth: '1px',
                      borderColor: theme === 'atomic' ? '#1A2A3A' : 'rgba(255,255,255,0.2)',
                      color: theme === 'atomic' ? '#EAF6FF' : 'white'
                    }}
                  >
                    <FaPhone className="w-4 h-4" />
                    (419) 555-1234
                  </motion.button>
                </a>
              </div>
            </motion.div>

            {/* Right - Hero Image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative lg:flex-1"
            >
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
                <Image
                  src="/images/toledo-hero.png"
                  alt="Appliance repair services in Toledo"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CITIES GRID */}
      <section className="relative py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 
              className="text-2xl lg:text-3xl font-bold transition-colors duration-500"
              style={{ color: theme === 'atomic' ? '#EAF6FF' : 'white' }}
            >
              Cities We{' '}
              <span 
                className="text-transparent bg-clip-text"
                style={{ 
                  backgroundImage: theme === 'atomic' 
                    ? 'linear-gradient(to right, #00E5FF, #00C2B8)' 
                    : 'linear-gradient(to right, #22d3ee, #67e8f9)' 
                }}
              >
                Serve
              </span>
            </h2>
            <p 
              className="mt-3 transition-colors duration-500"
              style={{ color: theme === 'atomic' ? '#9FB3C8' : '#9ca3af' }}
            >
              Click on a city to learn more about our services in your area.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.values(serviceAreas).map((area, i) => (
              <motion.div
                key={area.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Link href={`/service-areas/${area.slug}`}>
                  <div 
                    className="group p-6 rounded-2xl border transition-all cursor-pointer duration-300"
                    style={{
                      backgroundColor: theme === 'atomic' ? '#000811' : 'rgba(255,255,255,0.05)',
                      borderColor: theme === 'atomic' ? '#1A2A3A' : 'rgba(255,255,255,0.1)',
                    }}
                    onMouseEnter={(e) => {
                      if (theme === 'atomic') {
                        e.currentTarget.style.borderColor = '#00E5FF';
                        e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 229, 255, 0.25)';
                      } else {
                        e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.5)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = theme === 'atomic' ? '#1A2A3A' : 'rgba(255,255,255,0.1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-300"
                        style={{ 
                          backgroundColor: theme === 'atomic' ? 'rgba(0, 229, 255, 0.1)' : 'rgba(6, 182, 212, 0.1)' 
                        }}
                      >
                        <FaMapMarkerAlt 
                          className="w-5 h-5" 
                          style={{ color: theme === 'atomic' ? '#00E5FF' : '#22d3ee' }}
                        />
                      </div>
                      <FaArrowRight 
                        className="w-4 h-4 group-hover:translate-x-1 transition-all"
                        style={{ color: theme === 'atomic' ? '#6B7C8F' : '#6b7280' }}
                      />
                    </div>
                    <h3 
                      className="font-bold text-lg transition-colors group-hover:text-[#00E5FF]"
                      style={{ color: theme === 'atomic' ? '#EAF6FF' : 'white' }}
                    >
                      {area.name}, {area.state}
                    </h3>
                    <p style={{ color: theme === 'atomic' ? '#6B7C8F' : '#9ca3af' }} className="text-sm mt-1">
                      {area.stats.repairsCompleted}+ repairs completed
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Additional Cities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 p-6 rounded-2xl border transition-colors duration-500"
            style={{
              backgroundColor: theme === 'atomic' ? '#000811' : 'rgba(255,255,255,0.05)',
              borderColor: theme === 'atomic' ? '#1A2A3A' : 'rgba(255,255,255,0.1)',
            }}
          >
            <h3 
              className="font-bold mb-4 transition-colors duration-500"
              style={{ color: theme === 'atomic' ? '#EAF6FF' : 'white' }}
            >
              Additional Areas We Serve
            </h3>
            <div className="flex flex-wrap gap-2">
              {['Oregon', 'Holland', 'Rossford', 'Waterville', 'Whitehouse', 'Monclova', 'Swanton', 'Lambertville', 'Ottawa Hills', 'Point Place'].map((city, i) => (
                <span 
                  key={i} 
                  className="px-3 py-1.5 rounded-full border text-sm transition-all duration-300 cursor-default hover:border-[#00C2B8]"
                  style={{
                    backgroundColor: theme === 'atomic' ? 'rgba(0,8,17,0.5)' : 'rgba(255,255,255,0.05)',
                    borderColor: theme === 'atomic' ? '#1A2A3A' : 'rgba(255,255,255,0.1)',
                    color: theme === 'atomic' ? '#9FB3C8' : '#d1d5db',
                  }}
                >
                  {city}
                </span>
              ))}
            </div>
            <p 
              className="text-sm mt-4 transition-colors duration-500"
              style={{ color: theme === 'atomic' ? '#6B7C8F' : '#6b7280' }}
            >
              Don't see your city? We likely still serve your area! Call us at (419) 555-1234 to confirm.
            </p>
          </motion.div>
        </div>
      </section>

      {/* MAP SECTION */}
      <section 
        className="relative py-16 lg:py-20 border-t transition-colors duration-500"
        style={{ borderColor: theme === 'atomic' ? '#1A2A3A' : 'rgba(255,255,255,0.05)' }}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <p 
                className="text-sm font-semibold tracking-wider uppercase mb-3 transition-colors duration-500"
                style={{ color: theme === 'atomic' ? '#00E5FF' : '#22d3ee' }}
              >
                Coverage Area
              </p>
              <h2 
                className="text-2xl lg:text-3xl font-bold mb-4 transition-colors duration-500"
                style={{ color: theme === 'atomic' ? '#EAF6FF' : 'white' }}
              >
                We Cover 25 Miles Around Toledo
              </h2>
              <p 
                className="mb-6 transition-colors duration-500"
                style={{ color: theme === 'atomic' ? '#9FB3C8' : '#9ca3af' }}
              >
                Our service area covers Toledo and all surrounding communities within a 25-mile radius. If you're not sure whether you're in our coverage area, just give us a call!
              </p>

              <ul className="space-y-3 mb-6">
                {['Same-day service available', 'No extra travel fees within coverage area', 'Flexible scheduling options'].map((item, i) => (
                  <li 
                    key={i} 
                    className="flex items-center gap-3 transition-colors duration-500"
                    style={{ color: theme === 'atomic' ? '#9FB3C8' : '#d1d5db' }}
                  >
                    <div 
                      className="w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-500"
                      style={{ backgroundColor: theme === 'atomic' ? 'rgba(0, 229, 255, 0.15)' : 'rgba(6, 182, 212, 0.2)' }}
                    >
                      <div 
                        className="w-2 h-2 rounded-full transition-colors duration-500"
                        style={{ backgroundColor: theme === 'atomic' ? '#00E5FF' : '#22d3ee' }}
                      />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-4">
                <a href="tel:4195551234">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-3 rounded-xl font-semibold text-white flex items-center gap-2 transition-all duration-300"
                    style={{
                      background: theme === 'atomic' 
                        ? 'linear-gradient(135deg, #FF7A1A, #FF9A3D)' 
                        : 'linear-gradient(135deg, #fb923c, #fbbf24)',
                      boxShadow: theme === 'atomic' 
                        ? '0 0 25px rgba(255, 122, 26, 0.35)' 
                        : '0 0 25px rgba(249,115,22,0.4)'
                    }}
                  >
                    <FaPhone className="w-4 h-4" />
                    (419) 555-1234
                  </motion.button>
                </a>
                <Link href="/book">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all duration-300"
                    style={{
                      backgroundColor: 'transparent',
                      borderWidth: '1px',
                      borderColor: theme === 'atomic' ? '#1A2A3A' : 'rgba(255,255,255,0.2)',
                      color: theme === 'atomic' ? '#EAF6FF' : 'white'
                    }}
                  >
                    <FaCalendarAlt className="w-4 h-4" />
                    Book Online
                  </motion.button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative h-[350px] rounded-2xl overflow-hidden border transition-all duration-500"
              style={{
                backgroundColor: theme === 'atomic' ? '#000811' : 'transparent',
                backgroundImage: theme === 'atomic' ? 'none' : 'linear-gradient(to bottom right, rgba(6,182,212,0.1), rgba(249,115,22,0.1))',
                borderColor: theme === 'atomic' ? '#1A2A3A' : 'rgba(255,255,255,0.1)',
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div 
                    className="w-32 h-32 rounded-full border-4 flex items-center justify-center mx-auto mb-4 relative transition-colors duration-500"
                    style={{ 
                      borderColor: theme === 'atomic' ? 'rgba(0, 229, 255, 0.3)' : 'rgba(6, 182, 212, 0.3)',
                      boxShadow: theme === 'atomic' ? '0 0 30px rgba(0, 229, 255, 0.15)' : 'none'
                    }}
                  >
                    <div 
                      className="absolute inset-0 rounded-full animate-pulse transition-colors duration-500"
                      style={{ backgroundColor: theme === 'atomic' ? 'rgba(0, 229, 255, 0.1)' : 'rgba(6, 182, 212, 0.1)' }}
                    />
                    <FaMapMarkerAlt 
                      className="w-10 h-10 transition-colors duration-500"
                      style={{ color: theme === 'atomic' ? '#FF7A1A' : '#fb923c' }}
                    />
                  </div>
                  <p 
                    className="font-bold text-lg transition-colors duration-500"
                    style={{ color: theme === 'atomic' ? '#EAF6FF' : 'white' }}
                  >
                    Toledo, OH
                  </p>
                  <p 
                    className="text-sm transition-colors duration-500"
                    style={{ color: theme === 'atomic' ? '#6B7C8F' : '#9ca3af' }}
                  >
                    25-Mile Coverage Radius
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden"
          >
            <div 
              className="absolute inset-0 transition-all duration-500"
              style={{
                backgroundColor: theme === 'atomic' ? '#000811' : 'transparent',
                backgroundImage: theme === 'atomic' ? 'none' : 'linear-gradient(to right, rgba(6,182,212,0.2), #0d1117, rgba(249,115,22,0.2))',
              }}
            />
            <div 
              className="absolute inset-0 rounded-3xl border transition-colors duration-500"
              style={{ borderColor: theme === 'atomic' ? '#1A2A3A' : 'rgba(255,255,255,0.1)' }}
            />

            <div className="relative text-center p-10 lg:p-16">
              <h2 
                className="text-2xl lg:text-3xl font-bold mb-4 transition-colors duration-500"
                style={{ color: theme === 'atomic' ? '#EAF6FF' : 'white' }}
              >
                Ready for Fast, Reliable Appliance Repair?
              </h2>
              <p 
                className="max-w-xl mx-auto mb-8 transition-colors duration-500"
                style={{ color: theme === 'atomic' ? '#9FB3C8' : '#9ca3af' }}
              >
                We serve Toledo and surrounding areas with same-day service. Book online or give us a call!
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/book">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-4 rounded-xl font-semibold flex items-center gap-2 transition-all duration-300"
                    style={{
                      background: theme === 'atomic' 
                        ? 'linear-gradient(135deg, #00E5FF, #0A84FF)' 
                        : 'linear-gradient(to right, #06b6d4, #0891b2)',
                      color: theme === 'atomic' ? '#000208' : 'white',
                      boxShadow: theme === 'atomic' 
                        ? '0 0 30px rgba(0, 229, 255, 0.4)' 
                        : '0 0 30px rgba(34,211,238,0.4)'
                    }}
                  >
                    <FaCalendarAlt className="w-4 h-4" />
                    Book Your Service
                  </motion.button>
                </Link>
                <a href="tel:4195551234">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-4 rounded-xl font-semibold flex items-center gap-2 transition-all duration-300"
                    style={{
                      backgroundColor: 'transparent',
                      borderWidth: '1px',
                      borderColor: theme === 'atomic' ? 'rgba(255, 122, 26, 0.5)' : 'rgba(249, 115, 22, 0.5)',
                      color: theme === 'atomic' ? '#FF7A1A' : '#fb923c',
                    }}
                  >
                    <FaPhone className="w-4 h-4" />
                    Call (419) 555-1234
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

ServiceAreaIndex.getLayout = function getLayout(page) {
  return <HomeLayout title="Service Areas | Quantum Repair">{page}</HomeLayout>;
};
