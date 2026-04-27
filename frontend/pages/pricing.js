import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { 
  FaCheck, FaCheckCircle, FaShieldAlt, FaDollarSign, FaCalendarAlt, FaPhone,
  FaCog, FaTools, FaPuzzlePiece, FaClock, FaBan, FaFileInvoiceDollar,
  FaAward, FaUserCheck, FaStar
} from 'react-icons/fa';
import HomeLayout from '../components/layouts/HomeLayout';

const PRICING_TIERS = [
  {
    id: 'diagnostic',
    title: 'DIAGNOSTIC',
    price: '$89–$129',
    description: 'The first step to getting your appliance back to perfect working order.',
    features: [
      'Full appliance diagnosis',
      'Trip charge included',
      'Honest assessment',
      'Diagnostic fee applied toward repair'
    ],
    cta: 'Book Diagnostic',
    href: '/book',
    highlighted: false,
    icon: FaCog
  },
  {
    id: 'standard',
    title: 'STANDARD REPAIR',
    price: '$150–$350+',
    description: 'Our most common service for the majority of appliance repairs.',
    features: [
      'Labor included',
      'Most repairs completed same-day',
      'Quality parts & materials',
      '90-day parts & labor warranty'
    ],
    cta: 'Book Repair',
    href: '/book',
    highlighted: true,
    badge: 'MOST POPULAR',
    icon: FaTools
  },
  {
    id: 'priority',
    title: 'PRIORITY SERVICE',
    price: '$250–$500+',
    description: "Need it fixed fast? We'll get there when you need us most.",
    features: [
      'Same-day service guaranteed',
      'Priority scheduling',
      'After-hours availability',
      '90-day parts & labor warranty'
    ],
    cta: 'Book Priority Service',
    href: '/book',
    highlighted: false,
    icon: FaStar
  }
];

const PRICE_FACTORS = [
  {
    icon: FaCog,
    title: 'APPLIANCE TYPE',
    description: 'Different appliances have different components and complexity.'
  },
  {
    icon: FaPuzzlePiece,
    title: 'PARTS REQUIRED',
    description: 'The cost of parts varies depending on brand and availability.'
  },
  {
    icon: FaTools,
    title: 'COMPLEXITY',
    description: 'More complex issues may require additional time and labor.'
  },
  {
    icon: FaClock,
    title: 'URGENCY',
    description: 'Same-day or after-hours service may impact overall pricing.'
  }
];

const REPAIR_COSTS = [
  { service: 'Refrigerator Repair', icon: '/applianceicons/neon/neonfridge.png', range: '$180 – $400' },
  { service: 'Washer Repair', icon: '/applianceicons/neon/neonwasher.png', range: '$150 – $350' },
  { service: 'Dryer Repair', icon: '/applianceicons/neon/neondryer.png', range: '$140 – $300' },
  { service: 'Oven & Range Repair', icon: '/applianceicons/neon/neonrange.png', range: '$160 – $380' },
  { service: 'Dishwasher Repair', icon: '/applianceicons/neon/neondishwasher.png', range: '$140 – $320' },
  { service: 'Microwave Repair', icon: '/applianceicons/neon/neonmicrowave.png', range: '$120 – $250' },
];

const TRUST_FEATURES = [
  {
    icon: FaBan,
    title: 'NO HIDDEN FEES',
    description: 'What we quote is what you pay. Period.'
  },
  {
    icon: FaFileInvoiceDollar,
    title: 'UPFRONT QUOTES',
    description: 'We explain everything before any work starts.'
  },
  {
    icon: FaAward,
    title: 'WARRANTY INCLUDED',
    description: 'All repairs come with our standard warranty.'
  },
  {
    icon: FaUserCheck,
    title: "YOU'RE IN CONTROL",
    description: 'You approve the repair before we get to work.'
  }
];

export default function Pricing() {
  return (
    <>
      <Head>
        <title>Pricing | Quantum Repair - Transparent Appliance Repair Pricing</title>
        <meta name="description" content="Transparent appliance repair pricing in Toledo. No hidden fees, upfront quotes, and warranty included. See our diagnostic, repair, and priority service rates." />
      </Head>

      {/* Background */}
      <div className="fixed inset-0 -z-50 bg-[#0B0F1A] overflow-hidden">
        <div className="absolute w-[700px] h-[700px] bg-cyan-500/10 blur-[180px] top-[-100px] left-[-200px]" />
        <div className="absolute w-[500px] h-[500px] bg-orange-500/10 blur-[150px] bottom-[10%] right-[-100px]" />
      </div>

      {/* HERO SECTION */}
      <section className="relative pt-28 pb-16 lg:pt-36 lg:pb-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-cyan-400 text-sm font-semibold tracking-wider uppercase mb-4">
                Fair Prices. Honest Service.
              </p>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
                TRANSPARENT
                <br />
                PRICING.
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500">
                  NO SURPRISES.
                </span>
              </h1>

              <p className="mt-6 text-gray-400 text-lg max-w-md leading-relaxed">
                We believe in honest, upfront pricing so you know exactly what to expect before we even arrive.
              </p>

              {/* CTA */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link href="/book">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-3 rounded-xl font-semibold text-white bg-transparent border border-white/20 hover:bg-white/5 transition-all flex items-center gap-2"
                  >
                    <FaCalendarAlt className="w-4 h-4" />
                    Book Your Service
                  </motion.button>
                </Link>
                <a href="tel:4195551234" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                  <span>or call</span>
                  <span className="text-orange-400 font-semibold">(419) 555-1234</span>
                </a>
              </div>
            </motion.div>

            {/* Right - Image with Features */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              {/* Glow Effects */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-48 h-48 bg-cyan-500/20 blur-[80px]" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-48 h-48 bg-orange-500/20 blur-[80px]" />

              <div className="relative flex items-center gap-8">
                {/* Appliance Image Placeholder */}
                <div className="flex-1 relative h-[300px] lg:h-[350px]">
                  <div className="grid grid-cols-2 gap-4 h-full">
                    {['/applianceicons/neon/neonfridge.png', '/applianceicons/neon/neonwasher.png', '/applianceicons/neon/neonrange.png', '/applianceicons/neon/neondishwasher.png'].map((icon, i) => (
                      <div key={i} className="relative flex items-center justify-center">
                        <Image src={icon} alt="" width={60} height={60} className="object-contain opacity-60" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Feature List */}
                <div className="space-y-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Upfront. Fair. Always.</p>
                  {['No Hidden Fees', 'Upfront Quotes', 'Quality Parts', 'Warranty Included'].map((feature, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.1 }}
                      className="flex items-center gap-3"
                    >
                      <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center">
                        <FaCheck className="w-3 h-3 text-cyan-400" />
                      </div>
                      <span className="text-white text-sm font-medium">{feature}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* PRICING TIERS */}
      <section className="relative py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl lg:text-3xl font-bold text-white">
              OUR SERVICE{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">
                OPTIONS
              </span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 items-stretch">
            {PRICING_TIERS.map((tier, index) => {
              const Icon = tier.icon;
              return (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className={`relative ${tier.highlighted ? 'md:-mt-4 md:mb-4' : ''}`}
                >
                  {/* Badge */}
                  {tier.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <span className="px-4 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 text-white text-xs font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(34,211,238,0.5)]">
                        {tier.badge}
                      </span>
                    </div>
                  )}

                  <div className={`h-full p-6 rounded-2xl backdrop-blur-xl transition-all duration-300 flex flex-col ${
                    tier.highlighted 
                      ? 'bg-gradient-to-b from-cyan-500/10 to-transparent border-2 border-cyan-500/50 shadow-[0_0_40px_rgba(34,211,238,0.2)]' 
                      : 'bg-white/5 border border-white/10 hover:border-white/20'
                  }`}>
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                      tier.highlighted ? 'bg-cyan-500/20' : 'bg-white/5'
                    }`}>
                      <Icon className={`w-6 h-6 ${tier.highlighted ? 'text-cyan-400' : 'text-gray-400'}`} />
                    </div>

                    {/* Title & Price */}
                    <h3 className="text-sm font-bold text-gray-400 tracking-wider mb-2">{tier.title}</h3>
                    <p className={`text-3xl font-bold mb-3 ${
                      tier.highlighted 
                        ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300' 
                        : 'text-white'
                    }`}>
                      {tier.price}
                    </p>
                    <p className="text-gray-400 text-sm mb-6">{tier.description}</p>

                    {/* Features */}
                    <ul className="space-y-3 mb-6 flex-1">
                      {tier.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm">
                          <FaCheck className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                            tier.highlighted ? 'text-cyan-400' : 'text-gray-500'
                          }`} />
                          <span className="text-gray-300">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <Link href={tier.href}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`w-full py-3 rounded-xl font-semibold transition-all ${
                          tier.highlighted
                            ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-[0_0_25px_rgba(34,211,238,0.4)]'
                            : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                        }`}
                      >
                        {tier.cta}
                      </motion.button>
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* WHAT AFFECTS PRICE */}
      <section className="relative py-16 lg:py-20 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl lg:text-3xl font-bold text-white">
              WHAT AFFECTS THE{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500">
                PRICE
              </span>
              ?
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PRICE_FACTORS.map((factor, index) => {
              const Icon = factor.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h4 className="text-white font-bold text-sm mb-2">{factor.title}</h4>
                  <p className="text-gray-400 text-xs leading-relaxed">{factor.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TYPICAL REPAIR COSTS */}
      <section className="relative py-16 lg:py-20 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl lg:text-3xl font-bold text-white">
              TYPICAL REPAIR{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">
                COSTS
              </span>
            </h2>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Price Table */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
                  <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Service</span>
                  <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Typical Price Range</span>
                </div>

                {/* Rows */}
                {REPAIR_COSTS.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={`flex items-center justify-between px-6 py-4 ${
                      index !== REPAIR_COSTS.length - 1 ? 'border-b border-white/5' : ''
                    } hover:bg-white/5 transition-colors`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 relative">
                        <Image src={item.icon} alt="" fill className="object-contain" />
                      </div>
                      <span className="text-white font-medium">{item.service}</span>
                    </div>
                    <span className="text-cyan-400 font-semibold">{item.range}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Quote Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-orange-500/10 border border-cyan-500/20"
            >
              <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center mb-4">
                <FaShieldAlt className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Every repair is unique.</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                These are typical price ranges. We'll provide an exact quote before any work begins.
              </p>
              <Link href="/book">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 shadow-[0_0_25px_rgba(249,115,22,0.4)] hover:shadow-[0_0_35px_rgba(249,115,22,0.6)] transition-all"
                >
                  Get Your Quote
                </motion.button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* TRUST SECTION */}
      <section className="relative py-16 lg:py-20 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl lg:text-3xl font-bold text-white">
              YOU CAN COUNT{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-orange-400">
                ON US
              </span>
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {TRUST_FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all text-center"
                >
                  <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h4 className="text-white font-bold text-sm mb-2">{feature.title}</h4>
                  <p className="text-gray-400 text-xs leading-relaxed">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative rounded-3xl overflow-hidden"
          >
            {/* Background */}
            <div className="absolute inset-0 bg-[#0d1117]" />
            <div className="absolute left-0 top-0 w-1/2 h-full bg-gradient-to-r from-cyan-500/20 to-transparent" />
            <div className="absolute right-0 bottom-0 w-1/2 h-full bg-gradient-to-l from-orange-500/20 to-transparent" />
            <div className="absolute left-1/4 top-1/2 -translate-y-1/2 w-32 h-32 bg-orange-500/30 blur-3xl" />
            <div className="absolute inset-0 rounded-3xl border border-white/10" />

            {/* Content */}
            <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8 p-8 lg:p-12">
              {/* Phone Icon */}
              <div className="hidden lg:flex items-center justify-center w-20 h-20 rounded-full bg-cyan-500/10 border border-cyan-500/30">
                <FaPhone className="w-8 h-8 text-cyan-400" />
              </div>

              {/* Text */}
              <div className="flex-1 text-center lg:text-left">
                <h2 className="text-2xl lg:text-3xl font-bold text-white">
                  LET'S GET YOUR APPLIANCE
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-orange-400">
                    WORKING AGAIN.
                  </span>
                </h2>
                <p className="text-gray-400 mt-2">
                  Fast, reliable service at a fair price. Book your service today!
                </p>
              </div>

              {/* CTA */}
              <div className="flex flex-col items-center gap-3">
                <Link href="/book">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:shadow-[0_0_40px_rgba(34,211,238,0.6)] transition-all flex items-center gap-2"
                  >
                    <FaCalendarAlt className="w-4 h-4" />
                    Book Your Service
                  </motion.button>
                </Link>
                <p className="text-gray-400 text-sm">
                  or call{' '}
                  <a href="tel:4195551234" className="text-orange-400 hover:text-orange-300 font-medium">
                    (419) 555-1234
                  </a>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}

Pricing.getLayout = function getLayout(page) {
  return <HomeLayout title="Pricing | Quantum Repair">{page}</HomeLayout>;
};
