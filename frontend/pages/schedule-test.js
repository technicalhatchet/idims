import { useState, useEffect, useMemo } from 'react';
import { getSession } from '@auth0/nextjs-auth0';
import Head from 'next/head';
import Link from 'next/link';
import { parseISO, format, startOfWeek, endOfWeek } from 'date-fns';
import { motion } from 'framer-motion';
import TechDashboardLayout from '../components/layouts/TechDashboardLayout';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorAlert from '../components/ui/ErrorAlert';
import EventDetailModal from '../components/schedule/EventDetailModal';
import ScheduleTestTimeline, {
  AppointmentCardBadgeStack,
  NEON_RAILS,
  formatEquipmentSubtypeLabel,
} from '../components/schedule/ScheduleTestTimeline';
import { useSchedule } from '../hooks/useSchedule';
import { useTechnicians } from '../hooks/useTechnicians';
import { useAuthRedirect } from '../hooks/useAuthRedirect';

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

  const { data: techniciansData, isLoading: isLoadingTechnicians } = useTechnicians();

  const appointments = scheduleData?.appointments || [];

  const { map: technicianRailMap, orderedIds } = useTechnicianRails(techniciansData, appointments);
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

  const handleEventClick = (ev) => {
    const enhanced = {
      ...ev,
      work_order_id: ev.work_order_id || (ev.source === 'work_order' ? ev.id : null),
    };
    setSelectedEvent(enhanced);
  };

  /** Filter appointments to current range for list */
  const filteredAppointments = useMemo(() => {
    const list = (appointments || []).filter((a) => {
      if (!a.start) return false;
      const t = parseISO(a.start).getTime();
      return t >= startDate.getTime() && t <= endDate.getTime();
    });
    return list.sort((a, b) => parseISO(a.start) - parseISO(b.start));
  }, [appointments, startDate, endDate]);

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

  const dayHeaderLabel =
    viewType === 'day'
      ? `${format(startDate, 'EEE // MMMM d, yyyy')}`.toUpperCase()
      : viewType === 'week'
      ? `${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d, yyyy')}`.toUpperCase()
      : `${format(startDate, 'MMMM yyyy')}`.toUpperCase();

  return (
    <>
      <Head>
        <title>Schedule [Test] | Atomic Repair</title>
        <style>{`
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

        <div className="relative z-10 px-4 pt-5 max-w-lg mx-auto">
          {/* Page header — command titleplate */}
          <div className="relative mb-7 overflow-hidden rounded-2xl px-2 py-3">
            <div
              className="absolute inset-0 pointer-events-none rounded-2xl"
              style={{
                background:
                  'radial-gradient(ellipse 70% 80% at 12% 20%, rgba(0,217,255,0.07), transparent 45%), linear-gradient(180deg, rgba(255,255,255,0.02), transparent 40%)',
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="relative"
            >
              <h1
                className="text-[1.28rem] font-bold uppercase text-white"
                style={{
                  letterSpacing: '0.18em',
                  fontFamily: "'Orbitron', system-ui, sans-serif",
                  textShadow: '0 0 28px rgba(0,217,255,0.18), 0 2px 16px rgba(0,0,0,0.6)',
                }}
              >
                SCHEDULE
              </h1>
              <div className="flex items-center gap-2.5 mt-3">
                <span
                  className="text-[9px] uppercase font-semibold px-2.5 py-1 rounded-md border"
                  style={{
                    letterSpacing: '0.14em',
                    color: '#7EEEF8',
                    borderColor: 'rgba(0,217,255,0.22)',
                    background: 'linear-gradient(180deg, rgba(34,211,238,0.12), rgba(34,211,238,0.04))',
                    boxShadow: '0 0 18px rgba(0,217,255,0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
                  }}
                >
                  Tactical preview
                </span>
                <Link href="/schedule" className="text-[10px] tracking-wide" style={{ color: 'rgba(255,255,255,0.34)' }}>
                  Classic schedule →
                </Link>
              </div>
            </motion.div>
          </div>

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
            <div className="relative mb-4 w-full min-w-0">
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
            <div className="relative rounded-[26px] mb-4">
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
                      No appointments in this range.
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

        {selectedEvent && <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
      </div>
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
