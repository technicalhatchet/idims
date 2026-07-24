import Link from 'next/link';
import { FaCalendarPlus } from 'react-icons/fa';
import { getSchedulingMissing, isSchedulingReady, schedulingMissingLabels } from '../../../constants/applianceEquipment';

export default function ApplianceScheduleButton({
  appliance,
  scheduleHref,
  detailHref,
  selfSchedulingAllowed,
  compact = false,
}) {
  if (!selfSchedulingAllowed) return null;

  const baseClass =
    'inline-flex items-center justify-center gap-1.5 rounded-lg font-bold text-[#0A0F1E] bg-cyan-400 hover:bg-cyan-300 transition-colors shrink-0';

  if (appliance.active_repair) {
    return (
      <Link
        href={scheduleHref}
        onClick={(e) => e.stopPropagation()}
        className={`${baseClass} ${compact ? 'h-8 px-2.5 text-[11px]' : 'h-9 px-3 text-xs'}`}
        title="View active request"
      >
        <FaCalendarPlus className="w-3 h-3" />
        <span className={compact ? 'hidden sm:inline' : ''}>Request</span>
      </Link>
    );
  }

  if (appliance.can_schedule) {
    return (
      <Link
        href={scheduleHref}
        onClick={(e) => e.stopPropagation()}
        className={`${baseClass} ${compact ? 'h-8 px-2.5 text-[11px]' : 'h-9 px-3 text-xs'}`}
        title="Schedule service"
      >
        <FaCalendarPlus className="w-3 h-3" />
        <span className={compact ? 'hidden md:inline' : ''}>Schedule</span>
      </Link>
    );
  }

  if (!isSchedulingReady(appliance)) {
    const missing = schedulingMissingLabels(getSchedulingMissing(appliance));
    return (
      <Link
        href={detailHref}
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex items-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 font-semibold hover:bg-amber-500/15 transition-colors shrink-0 ${
          compact ? 'h-8 px-2.5 text-[10px]' : 'h-9 px-3 text-[11px]'
        }`}
        title={missing.length ? `Missing: ${missing.join(', ')}` : 'Complete appliance info to schedule'}
      >
        <span className="max-w-[88px] truncate">Complete info</span>
      </Link>
    );
  }

  return null;
}
