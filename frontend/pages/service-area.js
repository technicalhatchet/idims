import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaMapMarkerAlt, FaPhone, FaCalendarAlt, FaArrowRight } from 'react-icons/fa';
import HomeLayout from '../components/layouts/HomeLayout';
import { allCities, serviceAreas } from '../data/serviceAreas';

export default function ServiceAreaIndex() {
  const mainArea = serviceAreas.toledo;

  return (
    <>
      <Head>
        <title>Service Areas | Quantum Repair - Appliance Repair in Toledo & NW Ohio</title>
        <meta 
          name="description" 
          content="Quantum Repair serves Toledo, OH and surrounding areas including Sylvania, Maumee, Perrysburg, and more. Same-day appliance repair available." 
        />
      </Head>

      {/* Background */}
      <div className="fixed inset-0 -z-50 bg-[#0B0F1A] overflow-hidden">
        <div className="absolute w-[700px] h-[700px] bg-cyan-500/10 blur-[180px] top-[-100px] left-[-200px]" />
        <div className="absolute w-[500px] h-[500px] bg-orange-500/10 blur-[150px] bottom-[20%] right-[-100px]" />
      </div>

      {/* HERO */}
      <section className="relative pt-28 pb-16 lg:pt-36 lg:pb-20">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-cyan-400 text-sm font-semibold tracking-wider uppercase mb-4">
              Our Service Areas
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
              APPLIANCE REPAIR IN
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500">
                TOLEDO & NW OHIO
              </span>
            </h1>
            <p className="mt-6 text-gray-400 text-lg max-w-2xl mx-auto">
              We proudly serve Toledo and the surrounding communities with fast, reliable appliance repair. Same-day service available.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/book">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-[0_0_25px_rgba(34,211,238,0.4)] flex items-center gap-2"
                >
                  <FaCalendarAlt className="w-4 h-4" />
                  Book Service
                </motion.button>
              </Link>
              <a href="tel:4195551234">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-6 py-3 rounded-xl font-semibold text-white border border-white/20 hover:bg-white/5 transition-all flex items-center gap-2"
                >
                  <FaPhone className="w-4 h-4" />
                  (419) 555-1234
                </motion.button>
              </a>
            </div>
          </motion.div>
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
            <h2 className="text-2xl lg:text-3xl font-bold text-white">
              Cities We{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">
                Serve
              </span>
            </h2>
            <p className="text-gray-400 mt-3">
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
                  <div className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/50 transition-all cursor-pointer">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                        <FaMapMarkerAlt className="w-5 h-5 text-cyan-400" />
                      </div>
                      <FaArrowRight className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
                    </div>
                    <h3 className="text-white font-bold text-lg group-hover:text-cyan-400 transition-colors">
                      {area.name}, {area.state}
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">
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
            className="mt-12 p-6 rounded-2xl bg-white/5 border border-white/10"
          >
            <h3 className="text-white font-bold mb-4">Additional Areas We Serve</h3>
            <div className="flex flex-wrap gap-2">
              {['Oregon', 'Holland', 'Rossford', 'Waterville', 'Whitehouse', 'Monclova', 'Swanton', 'Lambertville', 'Ottawa Hills', 'Point Place'].map((city, i) => (
                <span 
                  key={i} 
                  className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-300 text-sm"
                >
                  {city}
                </span>
              ))}
            </div>
            <p className="text-gray-500 text-sm mt-4">
              Don't see your city? We likely still serve your area! Call us at (419) 555-1234 to confirm.
            </p>
          </motion.div>
        </div>
      </section>

      {/* MAP SECTION */}
      <section className="relative py-16 lg:py-20 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-cyan-400 text-sm font-semibold tracking-wider uppercase mb-3">
                Coverage Area
              </p>
              <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4">
                We Cover 25 Miles Around Toledo
              </h2>
              <p className="text-gray-400 mb-6">
                Our service area covers Toledo and all surrounding communities within a 25-mile radius. If you're not sure whether you're in our coverage area, just give us a call!
              </p>

              <ul className="space-y-3 mb-6">
                {['Same-day service available', 'No extra travel fees within coverage area', 'Flexible scheduling options'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-300">
                    <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-cyan-400" />
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
                    className="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 shadow-[0_0_25px_rgba(249,115,22,0.4)] flex items-center gap-2"
                  >
                    <FaPhone className="w-4 h-4" />
                    (419) 555-1234
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

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative h-[350px] rounded-2xl overflow-hidden bg-gradient-to-br from-cyan-500/10 to-orange-500/10 border border-white/10"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-32 h-32 rounded-full border-4 border-cyan-500/30 flex items-center justify-center mx-auto mb-4 relative">
                    <div className="absolute inset-0 rounded-full bg-cyan-500/10 animate-pulse" />
                    <FaMapMarkerAlt className="w-10 h-10 text-orange-400" />
                  </div>
                  <p className="text-white font-bold text-lg">Toledo, OH</p>
                  <p className="text-gray-400 text-sm">25-Mile Coverage Radius</p>
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
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-[#0d1117] to-orange-500/20" />
            <div className="absolute inset-0 rounded-3xl border border-white/10" />

            <div className="relative text-center p-10 lg:p-16">
              <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4">
                Ready for Fast, Reliable Appliance Repair?
              </h2>
              <p className="text-gray-400 max-w-xl mx-auto mb-8">
                We serve Toledo and surrounding areas with same-day service. Book online or give us a call!
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/book">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-[0_0_30px_rgba(34,211,238,0.4)] flex items-center gap-2"
                  >
                    <FaCalendarAlt className="w-4 h-4" />
                    Book Your Service
                  </motion.button>
                </Link>
                <a href="tel:4195551234">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-4 rounded-xl font-semibold text-orange-400 border border-orange-500/50 hover:bg-orange-500/10 transition-all flex items-center gap-2"
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
