import { motion, AnimatePresence } from 'framer-motion';
import { FaHome, FaChevronDown, FaHistory } from 'react-icons/fa';
import { propertyStats, propertyStatsSummaryLine } from './appliancesPageUtils';
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
  onFindFromHistory,
  historySuggestionCount = 0,
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
          <p className="text-sm font-semibold text-white truncate leading-tight">{group.label}</p>
          {group.subtitle ? (
            <p className="text-xs text-gray-500 truncate mt-0.5 leading-snug">{group.subtitle}</p>
          ) : null}
          <p className="text-[11px] text-gray-400 truncate mt-1">
            {propertyStatsSummaryLine(stats)}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onFindFromHistory ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFindFromHistory();
              }}
              className="lg:hidden h-8 px-2 rounded-lg text-[11px] font-semibold text-gray-400 hover:text-white hover:bg-white/10 inline-flex items-center gap-1"
              title="Find from service history"
            >
              <FaHistory className="w-3 h-3" />
              History
              {historySuggestionCount > 0 ? (
                <span className="min-w-[1rem] h-4 px-1 rounded-full bg-cyan-500/20 text-cyan-300 text-[9px] font-bold inline-flex items-center justify-center">
                  {historySuggestionCount}
                </span>
              ) : null}
            </button>
          ) : null}
          <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <FaChevronDown className="w-4 h-4 text-gray-500" />
          </motion.span>
        </div>
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
