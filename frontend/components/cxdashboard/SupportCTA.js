import { motion } from 'framer-motion';
import { FaPhone, FaComments, FaQuestionCircle } from 'react-icons/fa';

const VARIANTS = {
  default: {
    wrapper: 'relative rounded-2xl overflow-hidden',
    showGradient: true,
    icon: FaPhone,
    iconWrap: 'w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30',
    title: 'Have a question about your repair?',
    subtitle: "We're here to help!",
    button: (
      <a href="tel:4197941689">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-6 py-3 rounded-xl text-white font-semibold flex items-center gap-2 hover:shadow-[0_0_25px_rgba(251,146,60,0.4)] transition-all"
          style={{ background: 'linear-gradient(135deg, #fb923c 0%, #fbbf24 100%)' }}
        >
          <FaComments className="w-4 h-4" />
          Call Us
        </motion.button>
      </a>
    ),
  },
  invoices: {
    wrapper: 'rounded-lg border border-white/[0.06] bg-[#0D1525]/60',
    showGradient: false,
    icon: FaQuestionCircle,
    iconWrap: 'w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0',
    title: 'Need help with an invoice?',
    subtitle: "Contact our support team and we'll be happy to help.",
    button: (
      <a href="tel:4197941689">
        <button
          type="button"
          className="px-4 py-2 rounded-lg text-sm font-semibold text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10 transition-colors whitespace-nowrap"
        >
          Contact Support
        </button>
      </a>
    ),
  },
};

export default function SupportCTA({ variant = 'default' }) {
  const cfg = VARIANTS[variant] || VARIANTS.default;
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className={cfg.wrapper}
    >
      {cfg.showGradient && (
        <>
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-[#0d1117] to-orange-500/20" />
          <div className="absolute inset-0 border border-white/10 rounded-2xl" />
        </>
      )}

      <div className={`relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${variant === 'invoices' ? 'p-4 md:p-5' : 'p-6'}`}>
        <div className="flex items-start gap-3 min-w-0">
          <div className={cfg.iconWrap}>
            <Icon className={`${variant === 'invoices' ? 'w-3.5 h-3.5' : 'w-5 h-5'} text-cyan-400 ${variant === 'default' ? '-scale-x-100' : ''}`} />
          </div>
          <div className="min-w-0">
            <h4 className={`text-white font-semibold ${variant === 'invoices' ? 'text-sm' : ''}`}>{cfg.title}</h4>
            <p className={`text-gray-400 ${variant === 'invoices' ? 'text-xs mt-0.5' : 'text-sm'}`}>{cfg.subtitle}</p>
          </div>
        </div>
        {cfg.button}
      </div>
    </motion.div>
  );
}
