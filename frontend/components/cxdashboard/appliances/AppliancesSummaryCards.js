import { motion } from 'framer-motion';
import { FaBoxOpen, FaTools, FaShieldAlt, FaCalendarAlt } from 'react-icons/fa';

function SummaryCard({ title, value, subtitle, icon: Icon, accent = 'cyan', index }) {
  const iconWrap =
    accent === 'orange'
      ? 'bg-orange-500/15 text-orange-400'
      : accent === 'green'
        ? 'bg-green-500/15 text-green-400'
        : accent === 'violet'
          ? 'bg-violet-500/15 text-violet-300'
          : 'bg-cyan-500/10 text-cyan-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className="rounded-xl border border-white/10 bg-[#0D1525] p-4 min-w-0"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconWrap}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-gray-400 text-xs font-medium">{title}</p>
          <p className="text-white text-2xl font-bold leading-tight mt-0.5">{value}</p>
          {subtitle ? <p className="text-gray-500 text-[11px] mt-0.5 truncate">{subtitle}</p> : null}
        </div>
      </div>
    </motion.div>
  );
}

export default function AppliancesSummaryCards({ summary }) {
  const propertyLabel =
    summary.propertyCount === 1 ? 'Across 1 property' : `Across ${summary.propertyCount} properties`;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <SummaryCard
        index={0}
        title="Total Appliances"
        value={summary.total}
        subtitle={propertyLabel}
        icon={FaBoxOpen}
      />
      <SummaryCard
        index={1}
        title="Active Requests"
        value={summary.activeRequests}
        subtitle="Need attention"
        icon={FaTools}
        accent="orange"
      />
      <SummaryCard
        index={2}
        title="Under Warranty"
        value={summary.underWarranty}
        subtitle="Protected"
        icon={FaShieldAlt}
        accent="green"
      />
      <SummaryCard
        index={3}
        title="Maintenance Due"
        value={summary.maintenanceDue}
        subtitle="Within 30 days"
        icon={FaCalendarAlt}
        accent="violet"
      />
    </div>
  );
}
