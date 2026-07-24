import { useState, useRef } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { FaEllipsisV } from 'react-icons/fa';
import ApplianceIcon from '../ApplianceIcon';
import { applianceDisplayName } from '../../../constants/applianceEquipment';
import { getPrimaryStatus } from './appliancesPageUtils';
import ApplianceOverflowMenu from './ApplianceOverflowMenu';
import ApplianceScheduleButton from './ApplianceScheduleButton';

function DetailBlock({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-gray-200 break-words">{value || '—'}</p>
    </div>
  );
}

export default function ApplianceListRow({
  appliance,
  selfSchedulingAllowed,
  onEdit,
  onRemove,
  viewMode = 'list',
}) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchorRef = useRef(null);
  const displayName = applianceDisplayName(appliance);
  const detailId = appliance.id;
  const detailHref = `/cxdashboard/appliances/${encodeURIComponent(detailId)}`;
  const scheduleHref = `/cxdashboard/appliances/${encodeURIComponent(detailId)}/schedule`;
  const status = getPrimaryStatus(appliance);
  const lastService = appliance.last_service_date
    ? format(parseISO(appliance.last_service_date), 'MMM d, yyyy')
    : '—';
  const serviceCount = appliance.service_count || 0;

  const toggleExpanded = () => setExpanded((prev) => !prev);

  return (
    <div
      className={`border-b border-white/[0.06] last:border-b-0 ${
        viewMode === 'grid' ? 'rounded-lg border border-white/[0.07] last:border-b' : ''
      }`}
    >
      <motion.div
        layout
        className={`group flex items-center gap-3 px-3 sm:px-4 min-h-[72px] cursor-pointer transition-colors hover:bg-white/[0.03] ${
          expanded ? 'bg-white/[0.02]' : ''
        }`}
        onClick={toggleExpanded}
      >
        <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
          <ApplianceIcon
            type={appliance.equipment_subtype || appliance.subtype || appliance.equipment_type || appliance.type}
            className="w-5 h-5"
          />
        </div>

        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1.4fr_auto_1fr] sm:items-center gap-1 sm:gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{displayName}</p>
            {appliance.model ? (
              <p className="text-xs text-gray-500 truncate">{appliance.model}</p>
            ) : null}
          </div>

          <div className="flex sm:justify-center">
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${status.className}`}
            >
              {status.label}
            </span>
          </div>

          <div className="hidden sm:flex items-center justify-end gap-4 text-xs text-gray-400">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Last Service</p>
              <p className="text-gray-300">{lastService}</p>
            </div>
            <div className="text-right min-w-[72px]">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Services</p>
              <p className="text-cyan-300 font-semibold">{serviceCount}</p>
            </div>
          </div>
        </div>

        <div
          className="flex items-center gap-1.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <ApplianceScheduleButton
            appliance={appliance}
            scheduleHref={scheduleHref}
            detailHref={detailHref}
            selfSchedulingAllowed={selfSchedulingAllowed}
            compact
          />
          <div className="relative" ref={menuAnchorRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Appliance actions"
              aria-expanded={menuOpen}
            >
              <FaEllipsisV className="w-3.5 h-3.5" />
            </button>
            <ApplianceOverflowMenu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              anchorRef={menuAnchorRef}
              appliance={appliance}
              detailHref={detailHref}
              scheduleHref={scheduleHref}
              onEdit={onEdit}
              onRemove={onRemove}
            />
          </div>
        </div>
      </motion.div>

      <div className="sm:hidden px-3 pb-2 flex items-center justify-between text-xs text-gray-400 -mt-1">
        <span>Last: {lastService}</span>
        <span>
          <span className="text-cyan-300 font-semibold">{serviceCount}</span> service{serviceCount === 1 ? '' : 's'}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-white/[0.06] bg-black/20"
          >
            <div className="px-4 py-4 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-300/90 mb-2">General</p>
                <div className="grid grid-cols-2 gap-3">
                  <DetailBlock label="Model" value={appliance.model} />
                  <DetailBlock label="Serial Number" value={appliance.serial} />
                  <DetailBlock label="Manufacturer" value={appliance.make} />
                  <DetailBlock label="Notes" value={appliance.notes} />
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-300/90 mb-2">Warranty</p>
                <p className="text-sm text-gray-300">
                  {appliance.warranty_active
                    ? 'This appliance has active warranty coverage from a recent repair.'
                    : 'No active warranty on file.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <ApplianceScheduleButton
                  appliance={appliance}
                  scheduleHref={scheduleHref}
                  detailHref={detailHref}
                  selfSchedulingAllowed={selfSchedulingAllowed}
                />
                <Link
                  href={detailHref}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-white/5"
                >
                  View full details
                </Link>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
