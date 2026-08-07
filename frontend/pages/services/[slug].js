import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { 
  FaBolt, FaUserTie, FaDollarSign, FaShieldAlt,
  FaCalendarAlt, FaSearch, FaTools, FaThumbsUp,
  FaCheckCircle, FaPhone
} from 'react-icons/fa';
import HomeLayout from '../../components/layouts/HomeLayout';
import ServiceHero from '../../components/services/ServiceHero';
import IssueCard from '../../components/services/IssueCard';
import FeatureCard from '../../components/services/FeatureCard';
import FAQItem from '../../components/services/FAQItem';
import ProcessStep from '../../components/services/ProcessStep';
import { services, getServiceBySlug, getAllServiceSlugs } from '../../data/services';

const WHY_CHOOSE_US = [
  {
    icon: FaBolt,
    title: 'Fast Service',
    description: 'We offer same-day service in most cases because we know you can\'t wait.'
  },
  {
    icon: FaUserTie,
    title: 'Expert Technicians',
    description: 'Our certified professionals have years of experience fixing all major brands.'
  },
  {
    icon: FaDollarSign,
    title: 'Transparent Pricing',
    description: 'No hidden fees. We provide honest, upfront pricing before any work begins.'
  },
  {
    icon: FaShieldAlt,
    title: 'Satisfaction Guarantee',
    description: 'We\'re not happy until you are. 100% satisfaction guaranteed on all repairs.'
  }
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
  }
];

export default function ServiceDetailPage({ service }) {
  const router = useRouter();

  if (router.isFallback) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Service Not Found</h1>
          <Link href="/services" className="text-cyan-400 hover:underline">
            View All Services
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{service.title} in Toledo | Quantum Repair</title>
        <meta 
          name="description" 
          content={`Fast ${service.title.toLowerCase()} in Toledo. Same-day service available. ${service.description}`} 
        />
        <meta name="keywords" content={`${service.title.toLowerCase()}, ${service.applianceType} repair, Toledo, appliance repair`} />
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
      <ServiceHero service={service} />

      {/* COMMON PROBLEMS & WHAT WE FIX */}
      <section className="relative py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Common Problems */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
                <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wide">
                  Common {service.title.split(' ')[0]} Problems
                </h2>
                <div className="grid gap-3">
                  {service.commonIssues.map((issue, index) => (
                    <IssueCard key={index} issue={issue} index={index} />
                  ))}
                </div>
              </div>
            </motion.div>

            {/* What We Fix */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex flex-col gap-6"
            >
              <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 flex-1">
                <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wide">
                  What We Fix
                </h2>
                <ul className="space-y-3">
                  {service.servicesOffered.map((item, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="flex items-center gap-3 text-gray-300 text-sm"
                    >
                      <FaCheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      {item}
                    </motion.li>
                  ))}
                </ul>
              </div>

              {/* Warranty Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-orange-500/10 border border-cyan-500/20"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <FaShieldAlt className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold">All Repairs Backed by Warranty</h3>
                    <p className="text-gray-400 text-sm mt-1">
                      We stand behind our work with industry-leading warranties for your peace of mind.
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
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
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl lg:text-3xl font-bold text-white">
              WHY CHOOSE{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-orange-400">
                ATOMIC REPAIR
              </span>
              ?
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {WHY_CHOOSE_US.map((feature, index) => (
              <FeatureCard key={index} feature={feature} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative py-16 lg:py-20 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl lg:text-3xl font-bold text-white">
              HOW IT{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500">
                WORKS
              </span>
            </h2>
          </motion.div>

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

      {/* FAQ SECTION */}
      <section className="relative py-16 lg:py-20 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl lg:text-3xl font-bold text-white">
              FREQUENTLY ASKED{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">
                QUESTIONS
              </span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-4">
            {service.faqs.map((faq, index) => (
              <FAQItem key={index} faq={faq} index={index} />
            ))}
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
                <p className="text-orange-400 text-sm font-semibold tracking-wider uppercase mb-2">
                  Ready to Get Started?
                </p>
                <h2 className="text-2xl lg:text-3xl font-bold text-white">
                  LET'S GET YOUR {service.title.split(' ')[0].toUpperCase()}
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-orange-400">
                    WORKING AGAIN.
                  </span>
                </h2>
                <p className="text-gray-400 mt-2">
                  Don't let a broken {service.title.split(' ')[0].toLowerCase()} disrupt your day. Book your service now!
                </p>
              </div>

              {/* CTA */}
              <div className="flex flex-col items-center gap-3">
                <Link href={`/book?appliance=${service.applianceType}`}>
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
                    (419) 740-0146
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

export async function getStaticPaths() {
  const slugs = getAllServiceSlugs();
  const paths = slugs.map((slug) => ({
    params: { slug }
  }));

  return {
    paths,
    fallback: false
  };
}

export async function getStaticProps({ params }) {
  const service = getServiceBySlug(params.slug);

  if (!service) {
    return {
      notFound: true
    };
  }

  return {
    props: {
      service
    }
  };
}

ServiceDetailPage.getLayout = function getLayout(page) {
  return <HomeLayout>{page}</HomeLayout>;
};
