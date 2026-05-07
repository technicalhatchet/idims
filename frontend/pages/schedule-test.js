import { useState, useEffect, useMemo } from 'react';
import { getSession } from '@auth0/nextjs-auth0';
import Head from 'next/head';
import Link from 'next/link';
import { parseISO, format, startOfWeek, endOfWeek } from 'date-fns';
import { motion } from 'framer-motion';
import TechDashboardLayout from '../components/layouts/TechDashboardLayout';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorAlert from '../components/ui/ErrorAlert';
import StatusBadge from '../components/ui/StatusBadge';
import EventDetailModal from '../components/schedule/EventDetailModal';
import ScheduleTestTimeline, { NEON_RAILS } from '../components/schedule/ScheduleTestTimeline';
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

function Segment({ active, children, disabled, ...rest }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="flex-1 min-h-[46px] px-2 rounded-[11px] text-xs font-semibold tracking-wide uppercase transition-[color,background,box-shadow,border-color,opacity] duration-200 disabled:opacity-45 disabled:pointer-events-none"
      style={
        active
          ? {
              background: 'linear-gradient(180deg, rgba(34,211,238,0.24), rgba(34,211,238,0.1))',
              border: '1px solid rgba(34,211,238,0.32)',
              color: '#fff',
              boxShadow: '0 0 18px rgba(34,211,238,0.18)',
            }
          : {
              background: 'rgba(5,12,22,0.65)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.52)',
            }
      }
      {...rest}
    >
      {children}
    </button>
  );
}

function GlassAppointmentCard({ appointment, techColorMap, techNames, idx, onOpen }) {
  const rail = appointment.technician_id
    ? techColorMap[appointment.technician_id] || NEON_RAILS[0]
    : 'rgba(100,116,139,0.9)';
  const orderNum = appointment.order_number ? `WO #${appointment.order_number}` : appointment.title || 'Job';
  const typeLabel = appointment.appointment_type
    ? String(appointment.appointment_type).replace(/_/g, ' ')
    : 'Service';

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.24) }}
      onClick={() => onOpen?.(appointment)}
      className="w-full text-left rounded-2xl overflow-hidden mb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/45 group"
      whileTap={{ scale: 0.992 }}
      style={{
        boxShadow:
          '0 0 0 1px rgba(0,217,255,0.06), 0 12px 30px rgba(0,0,0,0.45), 0 0 24px rgba(34,211,238,0.06)',
      }}
    >
      <div
        className="flex w-full backdrop-blur-[18px] group-hover:border-cyan-400/22 transition-colors"
        style={{
          background: 'rgba(10, 18, 32, 0.82)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="w-1.5 flex-shrink-0" style={{ background: rail, boxShadow: `0 0 14px ${rail}44` }} />
        <div className="flex-1 py-3.5 px-4 flex gap-3 min-w-0">
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[13px] font-bold tracking-tight" style={{ color: 'rgba(255,255,255,0.94)' }}>
                {orderNum}
              </span>
              <StatusBadge status={appointment.status || 'scheduled'} />
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize border"
                style={{
                  borderColor: 'rgba(168,85,247,0.35)',
                  background: 'rgba(168,85,247,0.12)',
                  color: '#DDD6FE',
                  boxShadow: '0 0 10px rgba(168,85,247,0.12)',
                }}
              >
                {typeLabel}
              </span>
            </div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.48)' }}>
              {appointment.start
                ? `${format(parseISO(appointment.start), 'EEE MMM d — h:mm a')}${
                    appointment.end ? ` – ${format(parseISO(appointment.end), 'h:mm a')}` : ''
                  }`
                : ''}
            </p>
            <p className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {appointment.client_name || 'Client'}
            </p>
            <p className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.38)' }}>
              {appointment.technician_name || (appointment.technician_id ? techNames[appointment.technician_id] : null) || 'Unassigned'}
            </p>
          </div>
          <div className="flex flex-col justify-center flex-shrink-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-shadow group-hover:shadow-[0_0_14px_rgba(34,211,238,0.18)]"
              style={{ border: '1px solid rgba(34,211,238,0.28)', background: 'rgba(3,12,22,0.65)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: '#22D3EE', strokeWidth: 2 }}>
                <polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
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
    return keys.map((k) => ({ dateKey: k, items: buckets[k], label: format(parseISO(k), 'EEEE // MMMM d, yyyy').toUpperCase() }));
  }, [filteredAppointments]);

  const dayHeaderLabel =
    viewType === 'day'
      ? `${format(startDate, 'EEEE // MMMM d, yyyy')}`.toUpperCase()
      : viewType === 'week'
      ? `${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d, yyyy')}`.toUpperCase()
      : `${format(startDate, 'MMMM yyyy')}`.toUpperCase();

  return (
    <>
      <Head>
        <title>Schedule [Test] | Atomic Repair</title>
      </Head>

      <div
        className="min-h-screen pb-32"
        style={{
          background: 'linear-gradient(180deg, #020817 0%, #031225 100%)',
        }}
      >
        <div className="px-4 pt-5 max-w-lg mx-auto">
          {/* Page header */}
          <div className="relative mb-5 overflow-hidden rounded-2xl px-1 py-2">
            <div
              className="absolute inset-0 opacity-[0.35] pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(34,211,238,0.05) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(34,211,238,0.04) 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px, 20px 20px',
              }}
            />
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <h1 className="text-[1.35rem] font-bold tracking-[0.2em] text-white drop-shadow-[0_0_20px_rgba(34,211,238,0.15)]">
                SCHEDULE
              </h1>
              <p className="text-sm mt-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Manage jobs and appointments
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border border-cyan-500/25"
                  style={{ color: '#22D3EE', background: 'rgba(34,211,238,0.08)' }}
                >
                  Tactical preview
                </span>
                <Link href="/schedule" className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Classic schedule →
                </Link>
              </div>
            </motion.div>
          </div>

          {/* Command panel */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="rounded-[28px] p-4 mb-5 relative overflow-hidden"
            style={{
              background: 'rgba(14, 24, 42, 0.88)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid rgba(34,211,238,0.18)',
              boxShadow:
                '0 0 0 1px rgba(0,217,255,0.06), 0 12px 36px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)',
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.08] animate-pulse"
              style={{
                background:
                  'repeating-linear-gradient(-15deg, transparent, transparent 6px, rgba(34,211,238,0.12) 6px, rgba(34,211,238,0.12) 7px)',
              }}
            />
            <div className="relative z-[1] space-y-4">
              <div className="flex gap-2">
                <div className="flex flex-1 p-1 rounded-[14px] gap-1" style={{ background: 'rgba(2,8,18,0.55)' }}>
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
              </div>
              <div className="flex gap-2">
                <div className="flex flex-1 p-1 rounded-[14px] gap-1" style={{ background: 'rgba(2,8,18,0.55)' }}>
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

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={navigatePrevious}
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    border: '1px solid rgba(255,255,255,0.09)',
                    background: 'rgba(5,12,22,0.75)',
                  }}
                  aria-label="Previous"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ stroke: '#94A3B8', strokeWidth: 2 }}>
                    <polyline points="15 18 9 12 15 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                <div className="flex-1 min-w-[160px]">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Date
                  </label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(4,12,22,0.75)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: '#22D3EE', strokeWidth: 1.5 }}>
                      <rect x="3" y="4" width="18" height="18" rx="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <input
                      type="date"
                      value={formatDateForInput(viewType === 'month' ? startDate : viewType === 'week' ? startDate : startDate)}
                      onChange={(e) => handleDateRangeChange(new Date(`${e.target.value}T12:00:00`), true)}
                      className="flex-1 bg-transparent text-sm font-medium outline-none"
                      style={{ color: 'rgba(255,255,255,0.9)' }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={navigateNext}
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    border: '1px solid rgba(255,255,255,0.09)',
                    background: 'rgba(5,12,22,0.75)',
                  }}
                  aria-label="Next"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ stroke: '#94A3B8', strokeWidth: 2 }}>
                    <polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={navigateToday}
                  className="px-4 min-h-[46px] rounded-xl text-xs font-bold uppercase tracking-wider shrink-0"
                  style={{
                    border: '1px solid rgba(34,211,238,0.35)',
                    color: '#22D3EE',
                    background: 'rgba(34,211,238,0.08)',
                    boxShadow: '0 0 12px rgba(34,211,238,0.12)',
                  }}
                >
                  Today
                </button>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Technician
                </label>
                <div className="mt-1 relative">
                  <select
                    value={selectedTechnicianId}
                    onChange={(e) => {
                      setSelectedTechnicianId(e.target.value);
                      setTimeout(() => refetchSchedule(), 80);
                    }}
                    className="w-full rounded-xl px-4 py-3.5 pr-10 text-sm font-medium appearance-none outline-none"
                    style={{
                      background: 'rgba(4,12,22,0.85)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.9)',
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

          {/* Timeline header strip */}
          <div
            className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl mb-3"
            style={{
              background: 'rgba(8,14,26,0.85)',
              border: '1px solid rgba(34,211,238,0.12)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0" style={{ stroke: '#22D3EE', strokeWidth: 1.5 }}>
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span className="text-[11px] sm:text-xs font-bold tracking-[0.15em] truncate" style={{ color: 'rgba(255,255,255,0.78)' }}>
                {dayHeaderLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={navigateToday}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider"
              style={{ border: '1px solid rgba(255,122,0,0.35)', color: '#FF7A00', background: 'rgba(255,122,0,0.06)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ stroke: '#FF7A00', strokeWidth: 2 }}>
                <circle cx="12" cy="12" r="3"/>
                <line x1="12" y1="2" x2="12" y2="4"/>
                <line x1="12" y1="20" x2="12" y2="22"/>
              </svg>
              Today
            </button>
          </div>

          {/* Main body */}
          <div
            className="rounded-[24px] p-3 sm:p-4 relative overflow-hidden"
            style={{
              background: 'rgba(10, 18, 32, 0.55)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: 'inset 0 0 40px rgba(0,0,0,0.25)',
            }}
          >
            {isLoadingSchedule || isLoadingTechnicians ? (
              <div className="py-20 flex justify-center">
                <LoadingSpinner />
              </div>
            ) : scheduleError ? (
              <p className="text-center py-16 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Unable to load schedule.
              </p>
            ) : displayMode === 'timeline' && viewType === 'day' ? (
              <ScheduleTestTimeline
                appointments={filteredAppointments}
                anchorDate={startDate}
                technicianRailMap={technicianRailMap}
                onSelectEvent={handleEventClick}
              />
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
                  techNames={techNames}
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
                      techNames={techNames}
                      idx={i}
                      onOpen={handleEventClick}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Floating legend */}
        <div
          className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto z-40 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
          style={{
            background: 'rgba(8,14,26,0.92)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(34,211,238,0.15)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 0 24px rgba(34,211,238,0.06)',
          }}
        >
          {orderedIds.length === 0 ? (
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>
              Assign technicians to see legend colors
            </span>
          ) : (
            orderedIds.map((id) => (
              <div key={id} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{
                    background: technicianRailMap[id],
                    boxShadow: `0 0 10px ${technicianRailMap[id]}88`,
                  }}
                />
                <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  {techNames[id] || 'Technician'}
                </span>
              </div>
            ))
          )}
          <div className="w-px h-4 bg-white/10 hidden sm:block" />
          <div className="flex items-center gap-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ stroke: '#22D3EE', strokeWidth: 1.5 }}>
              <path d="M5 17h14v2H5v-2z" strokeLinecap="round"/>
              <path d="M7 17V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8" strokeLinecap="round"/>
            </svg>
            Travel lines = same tech, same day
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
