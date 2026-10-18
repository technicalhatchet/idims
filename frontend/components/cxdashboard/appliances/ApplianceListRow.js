import { useState, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { FaEllipsisV } from 'react-icons/fa';
import ApplianceIcon from '../ApplianceIcon';
import { applianceDisplayName } from '../../../constants/applianceEquipment';
import {
  formatApplianceLastService,
  getPrimaryStatus,
  statusLinePresentation,
} from './appliancesPageUtils';
import ApplianceOverflowMenu from './ApplianceOverflowMenu';
import ApplianceScheduleButton from './ApplianceScheduleButton';
import ApplianceSourceSubtitle from './ApplianceSourceSubtitle';

function DetailBlock({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-gray-200 break-words">{value || '—'}</p>
    </div>
  );
}

function ApplianceMetaLine({ appliance }) {
  const status = getPrimaryStatus(appliance);
  const { text: statusText, className: statusClass } = statusLinePresentation(status);
  const lastService = formatApplianceLastService(appliance.last_service_date);
  const serviceCount = appliance.service_count || 0;
  const servicesLabel = `${serviceCount} service${serviceCount === 1 ? '' : 's'}`;

  return (
    <p className="text-[11px] text-gray-500 truncate mt-0.5">
      <span className={`font-medium ${statusClass}`}>{statusText}</span>
      <span className="text-gray-600"> · </span>
      <span>{lastService}</span>
      <span className="text-gray-600"> · </span>
      <span>{servicesLabel}</span>
    </p>
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

  const toggleExpanded = () => setExpanded((prev) => !prev);

  return (
    <div
      className={`border-b border-white/[0.06] last:border-b-0 ${
        viewMode === 'grid' ? 'rounded-lg border border-white/[0.07] last:border-b' : ''
      }`}
    >
      <motion.div
        layout
        className={`group flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 min-h-[68px] cursor-pointer transition-colors hover:bg-white/[0.03] ${
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

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate leading-tight">{displayName}</p>
          <ApplianceSourceSubtitle
            appliance={appliance}
            className="text-xs text-gray-500 truncate mt-0.5 leading-snug"
          />
          <ApplianceMetaLine appliance={appliance} />
        </div>

        <div
          className="flex items-center gap-1.5 shrink-0 self-center"
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
