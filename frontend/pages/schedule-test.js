import { useState, useEffect, useMemo, useCallback, useLayoutEffect, useRef } from 'react';
import { getSession } from '@auth0/nextjs-auth0';
import Head from 'next/head';
import { parseISO, format, startOfWeek, endOfWeek } from 'date-fns';
import { motion } from 'framer-motion';
import TechDashboardLayout from '../components/layouts/TechDashboardLayout';
import { useHudGridDoubleTapRail } from '../hooks/useHudGridDoubleTapRail';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import PullToRefresh from '../components/ui/PullToRefresh';
import ErrorAlert from '../components/ui/ErrorAlert';
import MobileEventDetailModal from '../components/schedule/MobileEventDetailModal';
import CalendarBlockModal from '../components/schedule/CalendarBlockModal';
import ScheduleTestTimeline, {
  AppointmentCardBadgeStack,
  NEON_RAILS,
  formatEquipmentSubtypeLabel,
} from '../components/schedule/ScheduleTestTimeline';
import { useSchedule } from '../hooks/useSchedule';
import { useTechnicians } from '../hooks/useTechnicians';
import { useAuthRedirect } from '../hooks/useAuthRedirect';
import { useUserRole } from '../utils/auth0-helpers';
import {
  CALENDAR_BLOCK_ACCENT,
  calendarBlockTypeLabel,
  isCalendarBlockEvent,
} from '../utils/calendarBlockTypes';

/** Fractal noise + field grid constants (aligned with partswait / opsboard tactical column). */
const SCHED_TACTICAL_PAGE_BG = '#0A0F1E';
const SCHED_TACTICAL_NOISE_BG =
  'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")';

/** Match tactical field grid (`bg-[size:42px_42px]`). */
const HUD_GRID_STEP = 42;
const HUD_GRID_NUDGE_X = -1;
const HUD_GRID_NUDGE_Y = -1;

function positiveMod(n, m) {
  return ((n % m) + m) % m;
}

function hudGridShiftForTitleplate(dx, dy, step) {
  return {
    x: -positiveMod(dx, step),
    y: -positiveMod(dy, step),
  };
}

function formatDateForInput(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    const t = new Date();
    const y = t.getFullYear();
    const m = `${t.getMonth() + 1}`.padStart(2, '0');
    const d = `${t.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function useTechnicianRails(techniciansData, appointments) {
  return useMemo(() => {
    const ids = new Set();
    techniciansData?.items?.forEach((t) => ids.add(t.id));
    appointments?.forEach((a) => {
      if (a.technician_id) ids.add(a.technician_id);
    });
    const ordered = [...ids].sort();
    const map = {};
    ordered.forEach((id, i) => {
      map[id] = NEON_RAILS[i % NEON_RAILS.length];
    });
    return { map, orderedIds: ordered };
  }, [techniciansData, appointments]);
}

function techNameLookup(techniciansData) {
  const m = {};
  techniciansData?.items?.forEach((t) => {
    const nm = `${t.user?.first_name || ''} ${t.user?.last_name || ''}`.trim() || `Tech ${String(t.id).slice(0, 6)}`;
    m[t.id] = nm;
  });
  return m;
}

/** First names only — used in bottom legend chroma rail labels */
function techFirstNameLegendLookup(techniciansData) {
  const m = {};
  techniciansData?.items?.forEach((t) => {
    const fn = `${t.user?.first_name || ''}`.trim();
    m[t.id] = fn || `Tech ${String(t.id).slice(0, 6)}`;
  });
  return m;
}

function Segment({ active, children, disabled, ...rest }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`relative flex-1 overflow-hidden min-h-0 py-1 px-1 rounded-lg text-[10px] font-semibold uppercase leading-none transition-[color,background,box-shadow,border-color,opacity,transform] disabled:opacity-45 disabled:pointer-events-none sched-segment ${
        active ? 'sched-segment-active' : ''
      }`}
      style={{
        letterSpacing: '0.07em',
        transitionDuration: '180ms',
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        ...(active
          ? {
              background:
                'linear-gradient(180deg, rgba(125,239,253,0.38), rgba(34,211,238,0.16), rgba(14,165,233,0.1))',
              border: '1px solid rgba(183,246,253,0.58)',
              color: '#F0FBFF',
              boxShadow:
                '0 0 26px rgba(34,211,238,0.42), 0 0 12px rgba(56,189,248,0.22), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(6,62,76,0.45)',
            }
          : {
              background:
                'linear-gradient(180deg, rgba(12,74,106,0.48), rgba(6,52,74,0.42))',
              border: '1px solid rgba(34,211,238,0.18)',
              color: 'rgba(204,246,253,0.85)',
              boxShadow: 'inset 0 1px 0 rgba(103,232,249,0.08)',
            }),
      }}
      {...rest}
    >
      {active && (
        <span
          className="pointer-events-none absolute inset-0 opacity-30 sched-segment-shimmer"
          style={{
            background:
              'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.12) 45%, transparent 70%)',
          }}
        />
      )}
      <span className="relative z-[1]">{children}</span>
    </button>
  );
}

function GlassAppointmentCard({ appointment, techColorMap, idx, onOpen }) {
  if (isCalendarBlockEvent(appointment)) {
    const accent = CALENDAR_BLOCK_ACCENT[appointment.block_type] || CALENDAR_BLOCK_ACCENT.other;
    const headline = appointment.title || calendarBlockTypeLabel(appointment.block_type);
    const start = appointment.start ? parseISO(appointment.start) : null;
    return (
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.2) }}
        onClick={() => onOpen?.(appointment)}
        className="relative w-full text-left rounded-[14px] mb-5 px-4 py-3 border border-dashed focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        style={{
          borderColor: `${accent}66`,
          background: `linear-gradient(180deg, ${accent}14, rgba(6,12,22,0.95))`,
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
          {calendarBlockTypeLabel(appointment.block_type)}
        </p>
        <p className="text-sm font-semibold text-white/90 mt-0.5">{headline}</p>
        {start && (
          <p className="text-[11px] text-white/45 mt-1">{format(start, 'h:mm a')}</p>
        )}
      </motion.button>
    );
  }

  const rail = appointment.technician_id
    ? techColorMap[appointment.technician_id] || NEON_RAILS[0]
    : 'rgba(100,116,139,0.9)';
  const orderNum = appointment.order_number ? `WO #${appointment.order_number}` : appointment.title || 'Job';
  const typeLabel = appointment.appointment_type
    ? String(appointment.appointment_type).replace(/_/g, ' ')
    : 'Service';
  const typeIsDiagnostic = /diagnostic/i.test(typeLabel);
  const equipLabel = formatEquipmentSubtypeLabel(appointment);

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.18,
        delay: Math.min(idx * 0.03, 0.24),
        ease: [0.4, 0, 0.2, 1],
      }}
      onClick={() => onOpen?.(appointment)}
      className="relative w-full text-left rounded-[17px] overflow-hidden mb-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 group"
      whileTap={{ scale: 0.993 }}
      whileHover={{ y: -1 }}
    >
      {/* Local ambient pool */}
      <div
        className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-55 blur-xl -z-10"
        style={{
          background: `radial-gradient(ellipse 80% 65% at 20% 0%, ${rail}22, transparent 70%)`,
        }}
      />
      <div className="relative rounded-[inherit]">
        {/* Top reflection */}
        <div
          className="pointer-events-none absolute top-px left-[12%] right-[12%] h-px z-10 rounded-full opacity-45"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
          }}
        />
        <div
          className="flex w-full rounded-[inherit] overflow-hidden group-hover:shadow-[0_0_22px_rgba(34,211,238,0.1)] transition-shadow duration-[180ms]"
          style={{
            background: 'linear-gradient(180deg, rgba(10,18,32,0.96), rgba(5,10,20,0.96))',
            border: '1px solid rgba(255,255,255,0.055)',
            boxShadow:
              '0 0 0 1px rgba(0,217,255,0.05), 0 16px 36px rgba(0,0,0,0.55), 0 0 18px rgba(34,211,238,0.06), inset 0 1px 0 rgba(255,255,255,0.04)',
            backdropFilter: 'blur(20px)',
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div
            className="flex-shrink-0 my-2 ml-1.5 rounded-full"
            style={{
              width: 5,
              boxShadow: `0 0 18px ${rail}, 0 0 10px ${rail}aa`,
              background: rail,
            }}
          />
          <div className="flex-1 py-2.5 pl-2 pr-2 min-w-0 flex flex-row justify-between gap-2 items-center">
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span
                className="text-[11px] font-bold tracking-[-0.02em] leading-tight truncate min-w-0"
                style={{ color: 'rgba(255,255,255,0.96)' }}
              >
                {orderNum}
              </span>
              <p className="text-[10px] leading-snug tracking-wide" style={{ color: 'rgba(255,255,255,0.58)' }}>
                {appointment.start
                  ? `${format(parseISO(appointment.start), 'EEE MMM d — h:mm a')}${
                      appointment.end ? ` – ${format(parseISO(appointment.end), 'h:mm a')}` : ''
                    }`
                  : ''}
              </p>
              <p className="text-[11px] font-medium leading-tight truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
                {appointment.client_name || 'Client'}
              </p>
            </div>
            <AppointmentCardBadgeStack
              status={appointment.status || 'scheduled'}
              appointmentTypeLabel={typeLabel}
              typeIsDiagnostic={typeIsDiagnostic}
              equipLabel={equipLabel}
            />
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function ScheduleTestInner() {
  const [viewType, setViewType] = useState('day');
  const [displayMode, setDisplayMode] = useState('timeline');

  const getInitialDates = () => {
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);
    return { initialStartDate: todayStart, initialEndDate: todayEnd };
  };

  const { initialStartDate, initialEndDate } = getInitialDates();
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockModalMode, setBlockModalMode] = useState('create');
  const [blockModalEvent, setBlockModalEvent] = useState(null);

  const { isManager } = useUserRole();
  useAuthRedirect();

  useEffect(() => {
    if (viewType !== 'day' && displayMode === 'timeline') {
      setDisplayMode('list');
    }
  }, [viewType, displayMode]);

  const {
    data: scheduleData,
    isLoading: isLoadingSchedule,
    error: scheduleError,
    refetch: refetchSchedule,
  } = useSchedule({
    startDate,
    endDate,
    technicianId: selectedTechnicianId || undefined,
    viewType,
  });

  const { data: techniciansData, isLoading: isLoadingTechnicians, refetch: refetchTechnicians } = useTechnicians();

  const appointments = scheduleData?.appointments || [];
  const calendarBlocks = scheduleData?.calendar_blocks || [];

  const scheduleEvents = useMemo(() => {
    const merged = [...appointments, ...calendarBlocks];
    return merged.sort((a, b) => {
      const ta = a.start ? parseISO(a.start).getTime() : 0;
      const tb = b.start ? parseISO(b.start).getTime() : 0;
      return ta - tb;
    });
  }, [appointments, calendarBlocks]);

  const { map: technicianRailMap, orderedIds } = useTechnicianRails(techniciansData, scheduleEvents);
  const techNames = useMemo(() => techNameLookup(techniciansData), [techniciansData]);
  const techLegendFirstNames = useMemo(() => techFirstNameLegendLookup(techniciansData), [techniciansData]);

  useEffect(() => {
    if (scheduleError?.status !== 401) return;
    fetch('/api/auth/token?refresh=true', { method: 'POST' }).then(() => setTimeout(refetchSchedule, 800));
  }, [scheduleError, refetchSchedule]);

  const handleDateRangeChange = (changedDate, _isStart) => {
    let newStart;
    let newEnd;

    if (viewType === 'day') {
      newStart = new Date(changedDate);
      newStart.setHours(0, 0, 0, 0);
      newEnd = new Date(newStart);
      newEnd.setHours(23, 59, 59, 999);
    } else if (viewType === 'week') {
      const ref = new Date(changedDate);
      const d0 = ref.getDay();
      newStart = new Date(ref);
      newStart.setDate(ref.getDate() - d0);
      newStart.setHours(0, 0, 0, 0);
      newEnd = new Date(newStart);
      newEnd.setDate(newStart.getDate() + 6);
      newEnd.setHours(23, 59, 59, 999);
    } else {
      const ref = new Date(changedDate);
      newStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
      newEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
      newEnd.setHours(23, 59, 59, 999);
    }

    setStartDate(newStart);
    setEndDate(newEnd);
    setTimeout(() => refetchSchedule(), 100);
  };

  const handleViewTypeChange = (type) => {
    setViewType(type);
    const today = new Date();
    let newStart;
    let newEnd;

    if (type === 'day') {
      newStart = new Date(today);
      newStart.setHours(0, 0, 0, 0);
      newEnd = new Date(newStart);
      newEnd.setHours(23, 59, 59, 999);
    } else if (type === 'week') {
      newStart = startOfWeek(today, { weekStartsOn: 0 });
      newEnd = endOfWeek(today, { weekStartsOn: 0 });
    } else {
      newStart = new Date(today.getFullYear(), today.getMonth(), 1);
      newEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      newEnd.setHours(23, 59, 59, 999);
    }

    setStartDate(newStart);
    setEndDate(newEnd);
    setTimeout(() => refetchSchedule(), 100);
  };

  const navigatePrevious = () => {
    const ns = new Date(startDate);
    const ne = new Date(endDate);
    if (viewType === 'day') {
      ns.setDate(ns.getDate() - 1);
      ns.setHours(0, 0, 0, 0);
      ne.setTime(ns.getTime());
      ne.setHours(23, 59, 59, 999);
    } else if (viewType === 'week') {
      ns.setDate(ns.getDate() - 7);
      ne.setDate(ne.getDate() - 7);
    } else {
      ns.setMonth(ns.getMonth() - 1);
      ne.setFullYear(ns.getFullYear(), ns.getMonth() + 1, 0);
      ne.setHours(23, 59, 59, 999);
    }
    setStartDate(ns);
    setEndDate(ne);
    setTimeout(() => refetchSchedule(), 100);
  };

  const navigateNext = () => {
    const ns = new Date(startDate);
    const ne = new Date(endDate);
    if (viewType === 'day') {
      ns.setDate(ns.getDate() + 1);
      ns.setHours(0, 0, 0, 0);
      ne.setTime(ns.getTime());
      ne.setHours(23, 59, 59, 999);
    } else if (viewType === 'week') {
      ns.setDate(ns.getDate() + 7);
      ne.setDate(ne.getDate() + 7);
    } else {
      ns.setMonth(ns.getMonth() + 1);
      ns.setDate(1);
      ne.setFullYear(ns.getFullYear(), ns.getMonth() + 1, 0);
      ne.setHours(23, 59, 59, 999);
    }
    setStartDate(ns);
    setEndDate(ne);
    setTimeout(() => refetchSchedule(), 100);
  };

  const navigateToday = () => handleViewTypeChange(viewType);

  const handleRetry = () => {
    fetch('/api/auth/token?refresh=true', { method: 'POST' })
      .then(() => setTimeout(refetchSchedule, 400))
      .catch(() => refetchSchedule());
  };

  const handlePullRefresh = useCallback(async () => {
    await Promise.all([refetchSchedule(), refetchTechnicians()]);
  }, [refetchSchedule, refetchTechnicians]);

  const handleEventClick = (ev) => {
    if (isCalendarBlockEvent(ev)) {
      if (!isManager) return;
      setBlockModalEvent(ev);
      setBlockModalMode('edit');
      setShowBlockModal(true);
      return;
    }
    const enhanced = {
      ...ev,
      work_order_id: ev.work_order_id || (ev.source === 'work_order' ? ev.id : null),
    };
    setSelectedEvent(enhanced);
  };

  const openCreateBlockModal = () => {
    setBlockModalEvent(null);
    setBlockModalMode('create');
    setShowBlockModal(true);
  };

  /** Filter appointments and blocks to current range for list / timeline */
  const filteredAppointments = useMemo(() => {
    const list = (scheduleEvents || []).filter((a) => {
      if (!a.start) return false;
      const t = parseISO(a.start).getTime();
      return t >= startDate.getTime() && t <= endDate.getTime();
    });
    return list.sort((a, b) => parseISO(a.start) - parseISO(b.start));
  }, [scheduleEvents, startDate, endDate]);

  const groupedByDay = useMemo(() => {
    const buckets = {};
    filteredAppointments.forEach((a) => {
      const dk = format(parseISO(a.start), 'yyyy-MM-dd');
      if (!buckets[dk]) buckets[dk] = [];
      buckets[dk].push(a);
    });
    const keys = Object.keys(buckets).sort();
    return keys.map((k) => ({ dateKey: k, items: buckets[k], label: format(parseISO(k), 'EEE // MMMM d, yyyy').toUpperCase() }));
  }, [filteredAppointments]);

  const gridTapLayerRef = useHudGridDoubleTapRail();
  const tacticalColumnRef = useRef(null);
  const titleplateRef = useRef(null);
  const [hudGridShift, setHudGridShift] = useState({ x: 0, y: 0 });

  const syncHudGridAlignment = useCallback(() => {
    const col = tacticalColumnRef.current;
    const plate = titleplateRef.current;
    if (!col || !plate) return;
    const c = col.getBoundingClientRect();
    const p = plate.getBoundingClientRect();
    const dx = p.left - c.left;
    const dy = p.top - c.top;
    const base = hudGridShiftForTitleplate(dx, dy, HUD_GRID_STEP);
    setHudGridShift({ x: base.x + HUD_GRID_NUDGE_X, y: base.y + HUD_GRID_NUDGE_Y });
  }, []);

  useLayoutEffect(() => {
    syncHudGridAlignment();
    const raf = requestAnimationFrame(() => syncHudGridAlignment());
    const col = tacticalColumnRef.current;
    if (!col) {
      return () => cancelAnimationFrame(raf);
    }
    const ro = new ResizeObserver(() => syncHudGridAlignment());
    ro.observe(col);
    window.addEventListener('resize', syncHudGridAlignment);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', syncHudGridAlignment);
    };
  }, [syncHudGridAlignment]);

  const dayHeaderLabel =
    viewType === 'day'
      ? `${format(startDate, 'EEE // MMMM d, yyyy')}`.toUpperCase()
      : viewType === 'week'
      ? `${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d, yyyy')}`.toUpperCase()
      : `${format(startDate, 'MMMM yyyy')}`.toUpperCase();

  return (
    <>
      <Head>
        <title>Schedule | Atomic Repair</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <style>{`
          @keyframes sched-test-tactical-scan {
            0% { left: -48%; }
            100% { left: 115%; }
          }
          /* Titleplate inner grid — 42px phase-locked to column field grid */
          .sched-test-hud-titleplate-grid {
            background-image:
              linear-gradient(rgba(0,217,255,.07) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,217,255,.07) 1px, transparent 1px);
            background-size: ${HUD_GRID_STEP}px ${HUD_GRID_STEP}px;
            background-position: var(--sched-test-hud-grid-x, 0px) var(--sched-test-hud-grid-y, 0px);
          }
          .sched-hud-orbitron {
            font-family: 'Orbitron', system-ui, sans-serif;
          }
          .sched-hud-orbitron-glow {
            text-shadow:
              0 0 8px rgba(255,255,255,.15),
              0 0 18px rgba(0,217,255,.12),
              0 0 40px rgba(0,217,255,.08);
          }
          .sched-neon-edge {
            position: relative;
          }
          .sched-neon-edge::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            padding: 1px;
            background: linear-gradient(
              135deg,
              rgba(0,229,255,.55),
              rgba(0,102,255,.15),
              rgba(0,229,255,.35)
            );
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            mask-composite: exclude;
            pointer-events: none;
          }
          .sched-hud-scan::after {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(255,255,255,.06),
              transparent
            );
            animation: sched-hud-scan 5s linear infinite;
            border-radius: inherit;
            pointer-events: none;
          }
          @keyframes sched-hud-scan {
            100% { left: 120%; }
          }
          @keyframes sched-shimmer-pulse {
            0%, 100% { opacity: 0.2; }
            50% { opacity: 0.42; }
          }
          .sched-segment-active .sched-segment-shimmer {
            animation: sched-shimmer-pulse 2.8s ease-in-out infinite;
          }
          .sched-date-picker input[type="date"] {
            -webkit-appearance: none;
            appearance: none;
            border: none;
            box-shadow: none;
            color: #22d3ee;
          }
          .sched-date-picker input[type="date"]::-webkit-datetime-edit,
          .sched-date-picker input[type="date"]::-webkit-datetime-edit-fields-wrapper {
            background: transparent;
          }
          .sched-date-picker input[type="date"]::-webkit-datetime-edit-fields-wrapper {
            display: flex;
            width: 100%;
            justify-content: center;
            align-items: center;
            color: #22d3ee;
          }
          .sched-date-picker input[type="date"]::-webkit-datetime-edit-text-field,
          .sched-date-picker input[type="date"]::-webkit-datetime-edit-month-field,
          .sched-date-picker input[type="date"]::-webkit-datetime-edit-day-field,
          .sched-date-picker input[type="date"]::-webkit-datetime-edit-year-field {
            color: #22d3ee;
          }
          .sched-date-picker input[type="date"]::-webkit-datetime-edit {
            text-align: center;
          }
        `}</style>
      </Head>

      <PullToRefresh onRefresh={handlePullRefresh} disabled={!!selectedEvent}>
      {/* Layer 1–2: operational atmosphere */}
      <div className="relative min-h-screen pb-36 sched-ops-surface">
        <div
          className="fixed inset-0 pointer-events-none -z-20"
          style={{
            background: `
              radial-gradient(circle at 50% -8%, rgba(0,217,255,0.08), transparent 42%),
              radial-gradient(circle at 100% 35%, rgba(34,211,238,0.04), transparent 38%),
              linear-gradient(180deg, #020817 0%, #031225 100%)
            `,
          }}
        />
        <div
          className="fixed inset-0 pointer-events-none -z-18 opacity-[0.04]"
          style={{
            background: 'repeating-linear-gradient(0deg, transparent, transparent 140px, rgba(0,217,255,0.05) 141px, transparent 142px)',
          }}
        />

        <div ref={tacticalColumnRef} className="hud-tactical-column relative px-4 pt-0 pb-5 max-w-lg mx-auto min-h-screen">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute inset-0" style={{ background: SCHED_TACTICAL_PAGE_BG }} />
            <div
              className="absolute inset-0 opacity-[0.11]
                bg-[linear-gradient(rgba(0,217,255,.28)_1px,transparent_1px),linear-gradient(90deg,rgba(0,217,255,.28)_1px,transparent_1px)]
                bg-[size:42px_42px]"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,217,255,.13),transparent_48%)]" />
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[min(560px,120%)] h-[220px] bg-cyan-400/[0.085] blur-[120px] rounded-full" />
            <div
              className="absolute inset-0 opacity-[0.028]
                bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,.1),rgba(255,255,255,.1)_1px,transparent_1px,transparent_14px)]"
            />
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
              style={{ backgroundImage: SCHED_TACTICAL_NOISE_BG }}
            />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,.52)_100%)] pointer-events-none" />
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div
                className="absolute top-0 bottom-0 w-[42%]"
                style={{
                  left: '-48%',
                  background:
                    'linear-gradient(90deg, transparent 0%, transparent 32%, rgba(255,255,255,0.024) 50%, transparent 68%, transparent 100%)',
                  animation: 'sched-test-tactical-scan 6.5s linear infinite',
                }}
              />
            </div>
            <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] pointer-events-none" />
          </div>
          <div ref={gridTapLayerRef} className="absolute inset-0 z-[1]" aria-hidden />
          <div className="hud-grid-content relative z-10 p-4 sm:p-6">
          {/* Page header — tactical OPS BOARD titleplate */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="relative mb-4"
            data-hud-card
            onAnimationComplete={syncHudGridAlignment}
          >
            <div
              ref={titleplateRef}
              className="relative overflow-hidden rounded-[18px] md:rounded-[22px] border border-cyan-400/30 bg-[rgba(5,12,22,.84)] backdrop-blur-2xl px-3.5 py-3 md:px-5 md:py-4 shadow-[0_0_30px_rgba(0,217,255,.35)] sched-neon-edge sched-hud-scan"
              style={{
                ['--sched-test-hud-grid-x']: `${hudGridShift.x}px`,
                ['--sched-test-hud-grid-y']: `${hudGridShift.y}px`,
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-50 sched-test-hud-titleplate-grid"
                aria-hidden
              />
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-cyan-500/0 opacity-60 pointer-events-none rounded-[inherit]" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none z-[1]" />
              <div className="absolute bottom-0 left-4 right-4 md:left-8 md:right-8 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent pointer-events-none z-[1]" />

              <div className="relative z-[2] min-w-0">
                <p className="sched-hud-orbitron text-[8px] md:text-[9px] uppercase tracking-[0.22em] md:tracking-[0.32em] text-cyan-300 mb-1.5 font-semibold leading-tight">
                  TACTICAL OPERATIONS GRID
                </p>
                <h1 className="sched-hud-orbitron sched-hud-orbitron-glow whitespace-nowrap text-[1.0625rem] sm:text-xl md:text-2xl font-black uppercase tracking-[0.06em] sm:tracking-[0.1em] md:tracking-[0.14em] leading-none text-white">
                  Ops Board
                </h1>
                <div className="mt-2 md:mt-2.5 flex flex-wrap items-center gap-2">
                  <div className="h-px w-10 md:w-16 shrink-0 bg-gradient-to-r from-cyan-300 to-transparent" />
                  <span className="sched-hud-orbitron text-white/40 text-[9px] md:text-[10px] tracking-[0.14em] md:tracking-[0.22em] uppercase">
                    Online
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Command panel — holographic ops glass */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="rounded-[28px] p-2.5 mb-5 relative overflow-hidden"
            style={{
              background: 'linear-gradient(165deg, rgba(16,28,48,0.55) 0%, rgba(10,18,36,0.72) 48%, rgba(8,14,28,0.78) 100%)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(0,217,255,0.2)',
              boxShadow:
                '0 0 0 1px rgba(255,255,255,0.03), 0 0 30px rgba(0,217,255,0.08), 0 18px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.35)',
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 rounded-[28px] opacity-[0.9]"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.05), transparent 22%)',
              }}
            />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                background:
                  'repeating-linear-gradient(-12deg, transparent, transparent 7px, rgba(34,211,238,0.12) 7px, rgba(34,211,238,0.12) 8px)',
              }}
            />
            <div
              className="pointer-events-none absolute -bottom-24 left-1/2 -translate-x-1/2 w-[120%] h-40 rounded-full opacity-35 blur-3xl"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(0,217,255,0.12), transparent 70%)',
              }}
            />
            <div className="relative z-[1] space-y-2">
              <div className="flex flex-row gap-1.5 items-stretch">
                <div
                  className="flex flex-1 min-w-0 p-0.5 rounded-lg gap-px"
                  style={{
                    background: 'linear-gradient(180deg, rgba(15,71,93,0.55), rgba(6,41,54,0.52))',
                    boxShadow:
                      'inset 0 1px 0 rgba(103,232,249,0.1), inset 0 -3px 10px rgba(0,0,0,0.32)',
                  }}
                >
                  <Segment active={viewType === 'day'} onClick={() => handleViewTypeChange('day')}>
                    Day
                  </Segment>
                  <Segment active={viewType === 'week'} onClick={() => handleViewTypeChange('week')}>
                    Week
                  </Segment>
                  <Segment active={viewType === 'month'} onClick={() => handleViewTypeChange('month')}>
                    Month
                  </Segment>
                </div>
                <div
                  className="flex flex-1 min-w-0 p-0.5 rounded-lg gap-px"
                  style={{
                    background: 'linear-gradient(180deg, rgba(15,71,93,0.55), rgba(6,41,54,0.52))',
                    boxShadow:
                      'inset 0 1px 0 rgba(103,232,249,0.1), inset 0 -3px 10px rgba(0,0,0,0.32)',
                  }}
                >
                  <Segment active={displayMode === 'list'} onClick={() => setDisplayMode('list')}>
                    List
                  </Segment>
                  <Segment
                    active={displayMode === 'timeline'}
                    disabled={viewType !== 'day'}
                    onClick={() => viewType === 'day' && setDisplayMode('timeline')}
                    title={viewType !== 'day' ? 'Switch to Day for timeline' : undefined}
                  >
                    Timeline
                  </Segment>
                </div>
              </div>

              {!(displayMode === 'timeline' && viewType === 'day') && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={navigatePrevious}
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 duration-[180ms]"
                    style={{
                      border: '1px solid rgba(0,217,255,0.14)',
                      background: 'linear-gradient(180deg, rgba(8,14,26,0.9), rgba(4,10,18,0.95))',
                      boxShadow:
                        'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 18px rgba(0,217,255,0.06), 0 6px 16px rgba(0,0,0,0.35)',
                    }}
                    aria-label="Previous"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: 'rgba(255,255,255,0.45)', strokeWidth: 2 }}>
                      <polyline points="15 18 9 12 15 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  <div className="flex-1 min-w-[140px] h-10 flex">
                    <div
                      className="sched-date-picker relative flex w-full h-full min-h-0 items-center justify-center rounded-lg pl-8 pr-2 py-0"
                      style={{
                        background: 'linear-gradient(180deg, rgba(6,12,22,0.92), rgba(3,9,18,0.96))',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                      }}
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 shrink-0"
                        style={{ stroke: '#22D3EE', strokeWidth: 1.5, filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.35))' }}
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      <input
                        type="date"
                        aria-label="Select date"
                        value={formatDateForInput(startDate)}
                        onChange={(e) => handleDateRangeChange(new Date(`${e.target.value}T12:00:00`), true)}
                        className="w-full min-w-0 bg-transparent font-medium outline-none outline-offset-0 border-0 ring-0 tracking-wide text-[12px] leading-none h-full py-2 appearance-none text-center text-[#22D3EE]"
                        style={{ color: '#22D3EE' }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={navigateNext}
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 duration-[180ms]"
                    style={{
                      border: '1px solid rgba(0,217,255,0.14)',
                      background: 'linear-gradient(180deg, rgba(8,14,26,0.9), rgba(4,10,18,0.95))',
                      boxShadow:
                        'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 18px rgba(0,217,255,0.06), 0 6px 16px rgba(0,0,0,0.35)',
                    }}
                    aria-label="Next"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: 'rgba(255,255,255,0.45)', strokeWidth: 2 }}>
                      <polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={navigateToday}
                    className="px-3 h-10 rounded-lg text-[10px] font-bold uppercase tracking-[0.08em] shrink-0 flex items-center justify-center duration-[180ms]"
                    style={{
                      border: '1px solid rgba(0,217,255,0.3)',
                      color: '#AFEEF8',
                      background: 'linear-gradient(180deg, rgba(34,211,238,0.14), rgba(34,211,238,0.06))',
                      boxShadow:
                        'inset 0 1px 0 rgba(255,255,255,0.1), 0 0 20px rgba(0,217,255,0.15), 0 8px 20px rgba(0,0,0,0.35)',
                    }}
                  >
                    Today
                  </button>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.34)' }}>
                  Technician
                </label>
                <div className="mt-0.5 relative">
                  <select
                    value={selectedTechnicianId}
                    onChange={(e) => {
                      setSelectedTechnicianId(e.target.value);
                      setTimeout(() => refetchSchedule(), 80);
                    }}
                    className="w-full rounded-xl px-3 py-2.5 pr-10 text-xs font-medium appearance-none outline-none duration-[180ms]"
                    style={{
                      background: 'linear-gradient(180deg, rgba(8,14,26,0.95), rgba(4,10,20,0.98))',
                      border: '1px solid rgba(0,217,255,0.14)',
                      color: 'rgba(255,255,255,0.9)',
                      boxShadow:
                        'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 24px rgba(0,217,255,0.06), 0 10px 24px rgba(0,0,0,0.35)',
                      letterSpacing: '0.03em',
                    }}
                  >
                    <option value="">All Technicians</option>
                    {techniciansData?.items?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.user?.first_name} {t.user?.last_name}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-cyan-400/60">▾</span>
                </div>
              </div>

              {isManager && (
                <button
                  type="button"
                  onClick={openCreateBlockModal}
                  className="w-full mt-3 rounded-xl px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] duration-[180ms]"
                  style={{
                    border: '1px dashed rgba(167,139,250,0.45)',
                    color: 'rgba(216,180,254,0.95)',
                    background: 'linear-gradient(180deg, rgba(167,139,250,0.12), rgba(8,14,26,0.9))',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                  }}
                >
                  + Add time block
                </button>
              )}
            </div>
          </motion.div>

          {scheduleError && (
            <div className="mb-4">
              <ErrorAlert
                message={
                  scheduleError.status === 401
                    ? 'Session may have expired — try refresh.'
                    : scheduleError.message || 'Failed to load schedule.'
                }
                onRetry={handleRetry}
              />
            </div>
          )}

          {/* Day timeline: fused HUD fills column; other modes stay in Ops chamber */}
          {displayMode === 'timeline' && viewType === 'day' ? (
            <div className="relative mb-4 w-full min-w-0" data-hud-card>
              <ScheduleTestTimeline
                appointments={filteredAppointments}
                anchorDate={startDate}
                technicianRailMap={technicianRailMap}
                onSelectEvent={handleEventClick}
                dayHeaderTitle={dayHeaderLabel}
                onNavigateToday={navigateToday}
                onHudNavigatePrevious={navigatePrevious}
                onHudNavigateNext={navigateNext}
                hudDateISO={formatDateForInput(startDate)}
                onHudDateChange={(e) =>
                  handleDateRangeChange(new Date(`${e.target.value}T12:00:00`), true)
                }
                blockingStatus={
                  scheduleError ? 'error' : isLoadingSchedule || isLoadingTechnicians ? 'loading' : undefined
                }
              />
            </div>
          ) : (
            <div className="relative rounded-[26px] mb-4" data-hud-card>
              <div
                className="pointer-events-none absolute inset-[-1px] rounded-[inherit] opacity-50 blur-xl -z-[1]"
                style={{
                  background: 'radial-gradient(ellipse 90% 60% at 50% -10%, rgba(0,217,255,0.14), transparent 65%)',
                }}
              />
              <div
                className="rounded-[inherit] px-2.5 sm:px-3.5 py-4 sm:py-5 relative overflow-hidden isolate"
                style={{
                  background: 'linear-gradient(165deg, rgba(3,7,14,0.82) 0%, rgba(2,5,11,0.92) 100%)',
                  border: '1px solid rgba(0,217,255,0.08)',
                  boxShadow:
                    'inset 0 0 50px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(0,0,0,0.45), 0 20px 56px rgba(0,0,0,0.55)',
                }}
              >
                {/* Composited atmospheric grid */}
                <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]" aria-hidden>
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'radial-gradient(ellipse 75% 50% at 50% 10%, rgba(0,217,255,0.09), transparent 58%)',
                    }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      opacity: 0.7,
                      backgroundImage: `
                      repeating-linear-gradient(
                        90deg,
                        transparent 0,
                        transparent 47px,
                        rgba(0,217,255,0.055) 48px,
                        rgba(0,217,255,0.055) 49px
                      )
                    `,
                    }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      opacity: 0.8,
                      backgroundImage: `
                      repeating-linear-gradient(
                        to bottom,
                        transparent 0,
                        transparent 39px,
                        rgba(0,217,255,0.045) 40px
                      )
                    `,
                    }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      opacity: 0.68,
                      backgroundImage: `
                      repeating-linear-gradient(
                        to bottom,
                        transparent 0,
                        transparent 159px,
                        rgba(0,217,255,0.1) 160px
                      )
                    `,
                    }}
                  />
                  <div
                    className="absolute inset-0 rounded-[inherit]"
                    style={{
                      boxShadow:
                        'inset 0 1px 0 rgba(0,217,255,0.05), inset 0 0 72px rgba(0,0,0,0.48)',
                    }}
                  />
                </div>
                <div className="relative z-[1]">
                  {isLoadingSchedule || isLoadingTechnicians ? (
                    <div className="py-20 flex justify-center">
                      <LoadingSpinner />
                    </div>
                  ) : scheduleError ? (
                    <p className="text-center py-16 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      Unable to load schedule.
                    </p>
                  ) : filteredAppointments.length === 0 ? (
                    <p className="text-center py-16 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      No appointments or blocks in this range.
                    </p>
                  ) : viewType === 'day' ? (
                    filteredAppointments.map((a, i) => (
                      <GlassAppointmentCard
                        key={a.id || `${a.start}-${i}`}
                        appointment={a}
                        techColorMap={technicianRailMap}
                        idx={i}
                        onOpen={handleEventClick}
                      />
                    ))
                  ) : (
                    groupedByDay.map((g) => (
                      <div key={g.dateKey} className="mb-6 last:mb-0">
                        <p
                          className="text-[10px] font-bold tracking-[0.2em] mb-3 pl-1"
                          style={{ color: 'rgba(255,255,255,0.42)' }}
                        >
                          {g.label}
                        </p>
                        {g.items.map((a, i) => (
                          <GlassAppointmentCard
                            key={a.id || `${a.start}-${i}`}
                            appointment={a}
                            techColorMap={technicianRailMap}
                            idx={i}
                            onOpen={handleEventClick}
                          />
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Legend — integrated tactical dock */}
        <div className="fixed bottom-5 left-0 right-0 z-40 px-4 flex justify-center pointer-events-none">
          <div
            className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 max-w-lg w-full px-5 py-3.5 rounded-[22px]"
            style={{
              background: 'linear-gradient(180deg, rgba(10,18,34,0.88), rgba(5,10,22,0.92))',
              backdropFilter: 'blur(22px)',
              WebkitBackdropFilter: 'blur(22px)',
              border: '1px solid rgba(0,217,255,0.14)',
              boxShadow:
                '0 0 0 1px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05), 0 -4px 32px rgba(0,217,255,0.06), 0 16px 40px rgba(0,0,0,0.55)',
            }}
          >
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              {orderedIds.length === 0 ? (
                <span className="text-[10px] tracking-wide" style={{ color: 'rgba(255,255,255,0.34)' }}>
                  Assign technicians to see legend colors
                </span>
              ) : (
                orderedIds.map((id, i) => (
                  <div key={id} className={`flex items-center gap-2 ${i > 0 ? 'border-l border-white/[0.08] pl-4' : ''}`}>
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: technicianRailMap[id],
                        boxShadow: `0 0 12px ${technicianRailMap[id]}AA, 0 0 4px ${technicianRailMap[id]}88`,
                      }}
                    />
                    <span className="text-[10px] font-semibold tracking-[0.05em]" style={{ color: 'rgba(255,255,255,0.58)' }}>
                      {techLegendFirstNames[id] || techNames[id]?.split(/\s+/)[0] || 'Technician'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {selectedEvent && <MobileEventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}

        {isManager && (
          <CalendarBlockModal
            isOpen={showBlockModal}
            onClose={() => {
              setShowBlockModal(false);
              setBlockModalEvent(null);
            }}
            mode={blockModalMode}
            event={blockModalEvent}
            anchorDate={startDate}
            technicianId={selectedTechnicianId}
            technicians={techniciansData?.items || []}
            onSaved={() => refetchSchedule()}
          />
        )}
      </div>
      </PullToRefresh>
    </>
  );
}

export async function getServerSideProps(context) {
  const session = await getSession(context.req, context.res);
  if (!session) {
    return { redirect: { destination: '/api/auth/login', permanent: false } };
  }
  return { props: {} };
}

export default function ScheduleTestPage() {
  return (
    <TechDashboardLayout>
      <ScheduleTestInner />
    </TechDashboardLayout>
  );
}
