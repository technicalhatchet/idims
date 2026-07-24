import { motion, AnimatePresence } from 'framer-motion';
import { FaHome, FaChevronDown } from 'react-icons/fa';
import { propertyStats } from './appliancesPageUtils';
import ApplianceListRow from './ApplianceListRow';

export default function PropertyApplianceSection({
  group,
  expanded,
  onToggle,
  selfSchedulingAllowed,
  onEdit,
  onRemove,
  viewMode,
  showHeader = true,
}) {
  const stats = propertyStats(group.appliances);

  const row = (appliance) => (
    <ApplianceListRow
      key={appliance.id}
      appliance={appliance}
      selfSchedulingAllowed={selfSchedulingAllowed}
      onEdit={onEdit}
      onRemove={onRemove}
      viewMode={viewMode}
    />
  );

  if (!showHeader) {
    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
          {group.appliances.map(row)}
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-white/[0.07] bg-[#0D1525] overflow-visible">
        {group.appliances.map(row)}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        className="w-full rounded-xl border border-white/[0.07] bg-[#0D1525] px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
          <FaHome className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{group.label}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-[11px] text-gray-400">{stats.count} Appliance{stats.count === 1 ? '' : 's'}</span>
            {stats.activeRequests > 0 ? (
              <span className="text-[11px] font-semibold text-orange-400">
                {stats.activeRequests} Active Request{stats.activeRequests === 1 ? '' : 's'}
              </span>
            ) : null}
            {stats.underWarranty > 0 ? (
              <span className="text-[11px] font-semibold text-green-400">
                {stats.underWarranty} Under Warranty
              </span>
            ) : null}
          </div>
        </div>

        <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <FaChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key={group.key}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                {group.appliances.map(row)}
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.07] bg-[#0D1525] overflow-visible">
                {group.appliances.map(row)}
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
