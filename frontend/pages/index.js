import Head from 'next/head';
import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';
import HomeLayout from '../components/layouts/HomeLayout';
import { motion } from 'framer-motion';

export default function Home() {
  const { user } = useUser();

  const fadeUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.6 },
    viewport: { once: true }
  };

  return (
    <>
      <Head>
        <title>Quantum Repair | Appliance Repair Toledo</title>
      </Head>

      {/* GLOBAL BACKGROUND */}
      <div className="fixed inset-0 -z-50 bg-[#0B0F1A]">
        <div className="absolute w-[600px] h-[600px] bg-cyan-500/10 blur-[120px] top-[-100px] left-[-100px]" />
        <div className="absolute w-[600px] h-[600px] bg-orange-500/10 blur-[120px] bottom-[-100px] right-[-100px]" />
      </div>

      {/* HERO */}
      <section className="relative text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-12 items-center">

          {/* LEFT */}
          <motion.div {...fadeUp}>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Fast, Reliable{" "}
              <span className="text-cyan-400 drop-shadow-[0_0_12px_rgba(0,255,255,0.9)]">
                Appliance Repair
              </span>{" "}
              in Toledo
            </h1>

            <p className="mt-4 text-gray-300 text-lg">
              Same-day service. Honest diagnostics. No surprises.
            </p>

            {/* CTA */}
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/book">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  className="bg-cyan-400 text-black px-6 py-3 rounded-lg font-semibold shadow-lg shadow-cyan-400/40"
                >
                  Book Service Now
                </motion.button>
              </Link>

              <a href="tel:4190000000">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  className="border border-white/30 px-6 py-3 rounded-lg hover:bg-white/10"
                >
                  Call Now
                </motion.button>
              </a>
            </div>

            {/* MICROCOPY */}
            <p className="mt-3 text-sm text-gray-400">
              Takes less than 60 seconds • Same-day slots available
            </p>

            {/* AUTH */}
            <div className="mt-6 flex gap-4 text-sm">
              {user ? (
                <Link href="/dashboard" className="text-cyan-400 hover:underline">
                  Dashboard →
                </Link>
              ) : (
                <Link href="/api/auth/login" className="text-gray-400 hover:text-white">
                  Login
                </Link>
              )}
            </div>

            {/* TRUST */}
            <div className="mt-6 text-sm text-gray-400">
              ⭐ 4.9 Rated • Licensed & Insured • Same-Day Availability
            </div>
          </motion.div>

          {/* RIGHT VISUAL */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="relative rounded-2xl h-[340px] p-6 bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.4)]"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-orange-500/20 blur-2xl" />
            <span className="text-gray-500 z-10">[Technician Image]</span>
          </motion.div>

        </div>
      </section>

      {/* SERVICES */}
      <section className="text-white py-20 px-6">
        <motion.div {...fadeUp} className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold">Appliance Repair Services</h2>
          <p className="text-gray-400 mt-2">
            We fix all major appliances quickly and professionally.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">

            {[
              {
                title: "Refrigerator Repair",
                desc: "Fridge warm? Ice maker broken? Leaking?"
              },
              {
                title: "Washer & Dryer",
                desc: "Won’t drain, spin, or heat?"
              },
              {
                title: "Oven & Range",
                desc: "Not heating or cooking evenly?"
              },
              {
                title: "Dishwasher",
                desc: "Not cleaning or draining?"
              }
            ].map((service, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -8, scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className="bg-white/5 p-6 rounded-xl border border-white/10 hover:border-cyan-400/50 transition relative overflow-hidden"
              >
                <div className="absolute inset-0 opacity-0 hover:opacity-100 bg-gradient-to-r from-cyan-500/10 to-orange-500/10 blur-xl transition" />

                <h3 className="text-lg font-semibold text-cyan-400">
                  {service.title}
                </h3>

                <p className="text-gray-400 mt-2">{service.desc}</p>

                <Link href="/book" className="mt-4 inline-block text-orange-400">
                  Book Now →
                </Link>
              </motion.div>
            ))}

          </div>
        </motion.div>
      </section>

      {/* PRICING */}
      <section className="text-center py-20 text-white">
        <motion.div {...fadeUp}>
          <h2 className="text-3xl font-bold">Simple, Honest Pricing</h2>

          <p className="text-4xl text-orange-400 mt-6 font-bold drop-shadow-[0_0_10px_rgba(255,140,0,0.8)]">
            $89 Diagnostic
          </p>

          <p className="text-gray-400 mt-2">
            Waived if you proceed with the repair
          </p>

          <div className="mt-6 text-gray-300">
            ✔ No hidden fees <br />
            ✔ Upfront pricing <br />
            ✔ Warranty included
          </div>

          <Link href="/book">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="mt-6 bg-cyan-400 text-black px-6 py-3 rounded-lg font-semibold shadow-lg shadow-cyan-400/40"
            >
              Schedule Appointment
            </motion.button>
          </Link>
        </motion.div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 text-center text-white">
        <motion.div {...fadeUp}>
          <h2 className="text-3xl font-bold">
            Get Your Appliance Fixed Today
          </h2>

          <div className="mt-6 flex justify-center gap-4">
            <Link href="/book">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="bg-cyan-400 text-black px-6 py-3 rounded-lg shadow-lg shadow-cyan-400/40"
              >
                Book Now
              </motion.button>
            </Link>

            <a href="tel:4190000000">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="border px-6 py-3 rounded-lg"
              >
                Call Now
              </motion.button>
            </a>
          </div>

          <p className="mt-4 text-gray-400 text-sm">
            ✔ No commitment • ✔ Fast response • ✔ Trusted service
          </p>
        </motion.div>
      </section>
    </>
  );
}

Home.getLayout = function getLayout(page) {
  return <HomeLayout>{page}</HomeLayout>;
};