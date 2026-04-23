import Head from 'next/head';
import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';
import HomeLayout from '../components/layouts/HomeLayout';
import { motion } from 'framer-motion';

export default function Home() {
  const { user } = useUser();

  return (
    <>
      <Head>
        <title>Quantum Repair | Appliance Repair Toledo</title>
      </Head>

      {/* HERO */}
      <section className="relative bg-[#0B0F1A] text-white overflow-hidden">

        {/* Background Glow */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute w-[600px] h-[600px] bg-cyan-500/10 blur-[120px] top-[-100px] left-[-100px]" />
          <div className="absolute w-[600px] h-[600px] bg-orange-500/10 blur-[120px] bottom-[-100px] right-[-100px]" />
        </div>

        <div className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">

          {/* LEFT */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Fast, Reliable{" "}
              <span className="text-cyan-400 drop-shadow-[0_0_10px_rgba(0,255,255,0.8)]">
                Appliance Repair
              </span>{" "}
              in Toledo
            </h1>

            <p className="mt-4 text-gray-300 text-lg">
              Same-day service. Honest diagnostics. No surprises.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">

              {/* BOOK BUTTON */}
              <Link href="/book">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  className="bg-cyan-400 text-black px-6 py-3 rounded-lg font-semibold shadow-lg shadow-cyan-400/30"
                >
                  Book Service Now
                </motion.button>
              </Link>

              {/* CALL BUTTON */}
              <a href="tel:4190000000">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  className="border border-white/30 px-6 py-3 rounded-lg hover:bg-white/10"
                >
                  Call Now
                </motion.button>
              </a>

            </div>

            {/* AUTH BUTTONS */}
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
            className="relative bg-white/5 rounded-2xl h-[320px] flex items-center justify-center overflow-hidden border border-white/10"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 to-orange-500/10 blur-2xl" />
            <span className="text-gray-500 z-10">[Technician Image]</span>
          </motion.div>

        </div>
      </section>

      {/* SERVICES */}
      <section className="bg-[#0B0F1A] text-white py-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold">Appliance Repair Services</h2>
          <p className="text-gray-400 mt-2">
            We fix all major household appliances quickly and professionally.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">

            {[
              {
                title: "Refrigerator Repair",
                desc: "Not cooling? Leaking? Ice maker broken?"
              },
              {
                title: "Washer & Dryer",
                desc: "Won’t drain, spin, or heat?"
              },
              {
                title: "Oven & Range",
                desc: "Not heating or cooking unevenly?"
              },
              {
                title: "Dishwasher",
                desc: "Not cleaning or draining?"
              }
            ].map((service, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -6, scale: 1.02 }}
                className="bg-white/5 p-6 rounded-xl border border-white/10 hover:border-cyan-400/50"
              >
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
        </div>
      </section>

      {/* PRICING */}
      <section className="bg-[#0B0F1A] text-center py-20 text-white">
        <h2 className="text-3xl font-bold">Simple, Honest Pricing</h2>

        <p className="text-4xl text-orange-400 mt-6 font-bold">
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
          <button className="mt-6 bg-cyan-400 text-black px-6 py-3 rounded-lg font-semibold shadow-lg shadow-cyan-400/30">
            Schedule Appointment
          </button>
        </Link>
      </section>

      {/* FINAL CTA */}
      <section className="bg-[#0B0F1A] py-20 text-center text-white">
        <h2 className="text-3xl font-bold">
          Get Your Appliance Fixed Today
        </h2>

        <div className="mt-6 flex justify-center gap-4">
          <Link href="/book">
            <button className="bg-cyan-400 text-black px-6 py-3 rounded-lg">
              Book Now
            </button>
          </Link>

          <a href="tel:4190000000">
            <button className="border px-6 py-3 rounded-lg">
              Call Now
            </button>
          </a>
        </div>
      </section>
    </>
  );
}

Home.getLayout = function getLayout(page) {
  return <HomeLayout>{page}</HomeLayout>;
};