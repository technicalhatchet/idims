import { useState, useEffect, useMemo, useCallback, useLayoutEffect, useRef } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import Link from 'next/link';
import { format } from 'date-fns';
import TechDashboardLayout from '../../components/layouts/TechDashboardLayout';
import { useHudGridDoubleTapRail } from '../../hooks/useHudGridDoubleTapRail';
import ApplianceIcon from '../../components/ui/ApplianceIcon';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import StatusBadge from '../../components/ui/StatusBadge';
import { apiClient } from '../../utils/api-client';
import { getUserRole } from '../../utils/auth0-helpers';
import { FaPhone, FaMapMarkerAlt, FaCalendarAlt, FaChevronDown, FaChevronUp, FaClock, FaUser } from 'react-icons/fa';
import { NEON_RAILS } from '../../components/schedule/ScheduleTestTimeline';

/** Fractal noise texture for tactical HUD shell (matches tech dashboard board) */
const OPSBOARD_TACTICAL_NOISE_BG =
  'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")';

/** Match tactical field grid (`bg-[size:42px_42px]`). */
const HUD_GRID_STEP = 42;
/** Subpixel / DPR tweak — same as mass / partswait / headertest. */
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

/** Set to `true` to show Navigate / Call on expanded appointment cards */
const SHOW_NAVIGATE_AND_CALL_BUTTONS = false;

/** Statuses a tech can set from this board (appointment-level) */
const OPS_STATUS_OPTIONS = [
  { value: 'en_route', label: 'En Route' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'reschedule', label: 'Reschedule' },
  { value: 'completed_pending_payment', label: 'Done — collect payment' },
];

/** Schedule-test style stacked glow on technician rail (hex vs rgba) */
function technicianRailStyle(rail) {
  if (typeof rail === 'string' && rail.startsWith('#')) {
    return {
      background: rail,
      boxShadow: `0 0 18px ${rail}, 0 0 10px ${rail}aa`,
    };
  }
  return {
    background: rail,
    boxShadow: `0 0 18px ${rail}, 0 0 14px ${rail}`,
  };
}

const RAIL_FALLBACK = 'rgba(100,116,139,0.9)';

/** e.g. `CT-001017` → `#CT-001017` for WO link labels */
function formatOrderLinkLabel(orderNumber) {
  if (orderNumber == null || orderNumber === '') return null;
  const s = String(orderNumber).trim();
  return s.startsWith('#') ? s : `#${s}`;
}

function opsStatusButtonClass(value, currentStatus, updating) {
  const active = currentStatus === value;
  const dim = updating && !active;
  const base =
    'px-3 py-2.5 rounded-lg text-xs font-medium border transition-all active:scale-[0.98] text-center leading-tight ';
  const variants = {
    en_route: active
      ? 'border-cyan-400/70 bg-cyan-500/15 text-cyan-300 shadow-[0_0_12px_rgba(0,212,255,0.2)]'
      : 'border-white/10 bg-[#080C14] text-gray-300 hover:border-cyan-500/40',
    in_progress: active
      ? 'border-blue-400/70 bg-blue-500/15 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
      : 'border-white/10 bg-[#080C14] text-gray-300 hover:border-blue-500/40',
    reschedule: active
      ? 'border-violet-400/70 bg-violet-500/15 text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.2)]'
      : 'border-white/10 bg-[#080C14] text-gray-300 hover:border-violet-500/40',
    completed_pending_payment: active
      ? 'border-orange-400/70 bg-orange-500/15 text-orange-200 shadow-[0_0_12px_rgba(251,146,60,0.2)]'
      : 'border-white/10 bg-[#080C14] text-gray-300 hover:border-orange-500/40',
  };
  return base + (variants[value] || 'border-white/10 bg-[#080C14] text-gray-300') + (dim ? ' opacity-45 pointer-events-none' : '');
}

function AppointmentCard({ appointment, onStatusChange, railColor }) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [phone, setPhone] = useState(appointment.client_phone || '');
  const [currentStatus, setCurrentStatus] = useState(
    typeof appointment.status === 'string' ? appointment.status : appointment.status?.value || 'scheduled'
  );

  // Fetch phone when expanded
  useEffect(() => {
    if (!expanded || phone) return;
    const fetchPhone = async () => {
      try {
        const res = await apiClient(`work-orders/${appointment.work_order_id}`);
        const p = res?.client_user?.phone || res?.client?.phone || '';
        setPhone(p);
      } catch (err) {
        console.error('Error fetching phone:', err);
      }
    };
    fetchPhone();
  }, [expanded]);

  const address = appointment.location || appointment.service_location?.address || '';
  //const phone = appointment.client_phone || appointment.client?.phone || '';
  const clientName = appointment.client_name || appointment.client?.name || 'Client';
  const workOrderId = appointment.work_order_id;
  const startTime = appointment.start ? new Date(appointment.start) : null;
  const endTime = appointment.end ? new Date(appointment.end) : null;

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      let apptId = appointment.id;
      if (!apptId && appointment.work_order_id) {
        const apptRes = await apiClient(`work-orders/${appointment.work_order_id}/appointments`);
        const first = apptRes?.items?.[0];
        apptId = first?.id;
      }
      if (!apptId) throw new Error('No appointment id');

      await apiClient(`work-orders/appointments/${apptId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      setCurrentStatus(newStatus);
      if (onStatusChange) onStatusChange(appointment.id, newStatus);
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdating(false);
    }
  };

  const openMaps = () => {
    if (!address) return;
    const encoded = encodeURIComponent(address);
    window.open(`https://maps.google.com/?q=${encoded}`, '_blank');
  };

  const callClient = () => {
    if (!phone) return;
    window.location.href = `tel:${phone}`;
  };

  const statusForUi = typeof currentStatus === 'string' ? currentStatus : currentStatus?.value || 'scheduled';
  const completedTint = statusForUi === 'completed';
  const canceledTint = statusForUi === 'canceled' || statusForUi === 'cancelled';

  return (
    <div
      data-hud-card
      className={`rounded-lg mb-3 overflow-hidden flex shadow-sm ${
        completedTint ? 'opacity-80' : ''
      } ${canceledTint ? 'opacity-[0.65]' : ''} ${
        statusForUi === 'en_route' ? 'ring-1 ring-cyan-500/35' : ''
      }`}
      style={{ background: '#0D1525', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div
        className="flex-shrink-0 self-stretch w-[5px] rounded-l-lg"
        style={technicianRailStyle(railColor || RAIL_FALLBACK)}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        {/* Card Header - always visible */}
        <div className="p-4 cursor-pointer select-none" onClick={() => setExpanded(!expanded)}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 min-w-0">
                <FaClock className="text-cyan-400/80 text-sm flex-shrink-0" />
                <span className="font-bold text-white text-base sm:text-lg truncate">
                  {startTime ? format(startTime, 'h:mm a') : 'TBD'}
                  {endTime ? ` – ${format(endTime, 'h:mm a')}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <FaUser className="text-gray-500 text-sm flex-shrink-0" />
                <span className="text-gray-200 font-medium truncate">{clientName}</span>
              </div>
              {address && (
                <div className="flex items-start gap-2 mt-1 min-w-0">
                  <FaMapMarkerAlt className="text-gray-500 text-sm flex-shrink-0 mt-0.5" />
                  <span className="text-gray-400 text-sm break-words line-clamp-2">{address}</span>
                </div>
              )}
            </div>
            <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between gap-2 flex-shrink-0 sm:max-w-[11rem] w-full sm:w-auto">
              <div className="min-w-0 max-w-[10rem] flex justify-end sm:justify-end">
                <span className="inline-block max-w-full truncate align-middle">
                  <StatusBadge status={statusForUi} />
                </span>
              </div>
              {expanded ? <FaChevronUp className="text-gray-500 flex-shrink-0" /> : <FaChevronDown className="text-gray-500 flex-shrink-0" />}
            </div>
          </div>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="px-4 pb-4 pt-2 border-t border-white/10">
            {/* Navigate / Call: toggle SHOW_NAVIGATE_AND_CALL_BUTTONS at top of file */}
            {SHOW_NAVIGATE_AND_CALL_BUTTONS && (
            <div className="grid grid-cols-2 gap-3 mt-2 mb-4">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); openMaps(); }}
                disabled={!address}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-cyan-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] border border-cyan-400/50 bg-[#080C14] shadow-[0_0_10px_rgba(0,212,255,0.15)] hover:border-cyan-400/80"
              >
                <FaMapMarkerAlt />
                <span>Navigate</span>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); callClient(); }}
                disabled={!phone}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-orange-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] border border-orange-400/50 bg-[#080C14] shadow-[0_0_10px_rgba(255,122,0,0.12)] hover:border-orange-400/80"
              >
                <FaPhone />
                <span>Call</span>
              </button>
            </div>
            )}

            {/* Type + work order link + equipment icon */}
            {(appointment.appointment_type || workOrderId || appointment.equipment_type || appointment.equipment_subtype) && (
              <div className="mb-4 flex gap-3 items-start">
                <div className="min-w-0 flex-1">
                  {appointment.appointment_type && (
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Type</span>
                      <p className="text-gray-100 font-medium capitalize">{appointment.appointment_type}</p>
                    </div>
                  )}
                  {workOrderId && (
                    <Link
                      href={`/work_orders/${workOrderId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                    >
                      {formatOrderLinkLabel(appointment.order_number) || 'Work order'}
                    </Link>
                  )}
                </div>
                <div
                  className="flex-shrink-0 w-16 h-16 rounded-lg flex items-center justify-center self-start"
                  style={{ background: '#000000', border: '1px solid rgba(255,255,255,0.1)' }}
                  title={[appointment.equipment_make, appointment.equipment_model].filter(Boolean).join(' ') || undefined}
                >
                  <ApplianceIcon
                    equipmentType={appointment.equipment_type}
                    equipmentSubtype={appointment.equipment_subtype}
                    className="w-10 h-10"
                  />
                </div>
              </div>
            )}

            {/* Services */}
            {appointment.services && appointment.services.length > 0 && (
              <div className="mb-3">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Services</span>
                {appointment.services.map((s, i) => (
                  <p key={i} className="text-gray-300 text-sm">{s.name}</p>
                ))}
              </div>
            )}

            {/* Notes */}
            {appointment.notes && (
              <div className="mb-3">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Notes</span>
                <p className="text-gray-300 text-sm">{appointment.notes}</p>
              </div>
            )}

            {/* Status update */}
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Update status</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {OPS_STATUS_OPTIONS.map(opt => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={(e) => { e.stopPropagation(); handleStatusChange(opt.value); }}
                    disabled={updating || statusForUi === opt.value}
                    className={opsStatusButtonClass(opt.value, statusForUi, updating)}
                  >
                    {updating && statusForUi !== opt.value ? '…' : opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TodaysRoute() {
  const { user, isLoading: authLoading } = useUser();

  // Add this at the top of the component, before other logic
  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = '/api/auth/login';
    }
  }, [user, authLoading]);
  const [technicians, setTechnicians] = useState([]);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchWO, setSearchWO] = useState('');
  const scheduleDateISO = format(new Date(), 'yyyy-MM-dd');
  const scheduleDateDisplay = format(new Date(), 'EEEE, MMM d, yyyy');

  const userRole = user ? getUserRole(user) : null;
  const isTechnician = userRole === 'technician';

  // Fetch technicians list (admin/manager only)
  useEffect(() => {
    if (isTechnician) return;
    const fetchTechs = async () => {
      try {
        const res = await apiClient('technicians');
        setTechnicians(res?.items || []);
      } catch (err) {
        console.error('Error fetching technicians:', err);
      }
    };
    fetchTechs();
  }, [isTechnician]);

  // Auto-select current technician if user is a tech
  useEffect(() => {
    if (!isTechnician || !user) return;
    const findMyTech = async () => {
      try {
        const res = await apiClient('technicians');
        const techs = res?.items || [];
        const myTech = techs.find(t =>
          t.user?.email === user.email || t.user_email === user.email
        );
        if (myTech) setSelectedTechId(myTech.id);
      } catch (err) {
        console.error('Error finding technician:', err);
      }
    };
    findMyTech();
  }, [isTechnician, user]);

  // Fetch appointments for today only and selected technician
  useEffect(() => {
    const fetchAppointments = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let url = `scheduling/schedule/combined?start_date=${scheduleDateISO}&end_date=${scheduleDateISO}&view_type=day`;
        if (selectedTechId) url += `&technician_id=${selectedTechId}`;
        const res = await apiClient(url);
        const appts = res?.appointments || [];
        // Sort by scheduled_start
        appts.sort((a, b) => new Date(a.start || a.scheduled_start) - new Date(b.start || b.scheduled_start));
        setAppointments(appts);

       
      } catch (err) {
        console.error('Error fetching appointments:', err);
        setError('Failed to load appointments.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAppointments();
  }, [scheduleDateISO, selectedTechId]);

  const getTechName = (tech) => {
    if (tech?.user?.first_name || tech?.user?.last_name) {
      return `${tech.user.first_name || ''} ${tech.user.last_name || ''}`.trim();
    }
    return tech?.employee_id ? `Tech (${tech.employee_id})` : 'Unknown';
  };

  const filteredAppointments = searchWO
    ? appointments.filter(a =>
        a.order_number?.toLowerCase().includes(searchWO.toLowerCase()) ||
        a.work_order_id?.toLowerCase().includes(searchWO.toLowerCase())
      )
    : appointments;

  /** Match schedule-test: per-day chroma rail per technician (cyan / orange / violet / green) */
  const techRailMap = useMemo(() => {
    const ids = new Set();
    appointments.forEach((a) => {
      if (a.technician_id) ids.add(String(a.technician_id));
    });
    const ordered = [...ids].sort();
    const map = {};
    ordered.forEach((id, i) => {
      map[id] = NEON_RAILS[i % NEON_RAILS.length];
    });
    return map;
  }, [appointments]);

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
    const col = tacticalColumnRef.current;
    if (!col) return undefined;
    const ro = new ResizeObserver(() => syncHudGridAlignment());
    ro.observe(col);
    window.addEventListener('resize', syncHudGridAlignment);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncHudGridAlignment);
    };
  }, [syncHudGridAlignment]);

  return (
    <>
      <Head>
        <title>Mission Queue | IDIMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <style>{`
          @keyframes opsboard-tactical-scan {
            0% { left: -48%; }
            100% { left: 115%; }
          }
          /* Titleplate — violet chroma; grid step matches field (42px) + alignment vars */
          .ops-queue-titleplate-grid {
            background-image:
              linear-gradient(rgba(167,139,250,.085) 1px, transparent 1px),
              linear-gradient(90deg, rgba(167,139,250,.085) 1px, transparent 1px);
            background-size: ${HUD_GRID_STEP}px ${HUD_GRID_STEP}px;
            background-position: var(--ops-queue-hud-grid-x, 0px) var(--ops-queue-hud-grid-y, 0px);
          }
          .ops-queue-titleplate-orbitron {
            font-family: 'Orbitron', system-ui, sans-serif;
          }
          .ops-queue-titleplate-title-glow {
            text-shadow:
              0 0 8px rgba(255,255,255,.12),
              0 0 18px rgba(167,139,250,.35),
              0 0 40px rgba(139,92,246,.22);
          }
          .ops-queue-titleplate-edge {
            position: relative;
          }
          .ops-queue-titleplate-edge::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            padding: 1px;
            background: linear-gradient(
              135deg,
              rgba(167,139,250,.72),
              rgba(88,28,135,.28),
              rgba(139,92,246,.5)
            );
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            mask-composite: exclude;
            pointer-events: none;
          }
          .ops-queue-titleplate-scan::after {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(167,139,250,.085),
              transparent
            );
            animation: ops-queue-titleplate-scan 5s linear infinite;
            border-radius: inherit;
            pointer-events: none;
          }
          @keyframes ops-queue-titleplate-scan {
            100% { left: 120%; }
          }
          header, nav, .header-bar, [class*='h-16'] {
            background-color: #0D1525 !important;
            border-bottom: 1px solid rgba(255,255,255,0.07) !important;
          }
        `}</style>
      </Head>

      <div className="min-h-screen pb-8" style={{ background: '#0A0F1E' }}>
        <div ref={tacticalColumnRef} className="hud-tactical-column relative px-4 pt-0 pb-5 max-w-lg mx-auto">
          {/* Tactical background — full column; same pattern as work_orders/test */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute inset-0" style={{ background: '#0A0F1E' }} />
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
              style={{ backgroundImage: OPSBOARD_TACTICAL_NOISE_BG }}
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
                  animation: 'opsboard-tactical-scan 6.5s linear infinite',
                }}
              />
            </div>
            <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] pointer-events-none" />
          </div>

          <div ref={gridTapLayerRef} className="absolute inset-0 z-[1]" aria-hidden />

          <div className="hud-grid-content relative z-10">
            <div className="sticky z-[1100] mb-4 top-[72px]">
              <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-5 space-y-4">
                <div
                  ref={titleplateRef}
                  data-hud-card
                  className="relative overflow-hidden rounded-[18px] md:rounded-[22px] border border-violet-400/40 bg-[rgba(5,12,22,.84)] backdrop-blur-2xl px-3.5 py-3 md:px-5 md:py-4 shadow-[0_0_30px_rgba(139,92,246,.38)] ops-queue-titleplate-edge ops-queue-titleplate-scan"
                  style={{
                    ['--ops-queue-hud-grid-x']: `${hudGridShift.x}px`,
                    ['--ops-queue-hud-grid-y']: `${hudGridShift.y}px`,
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-50 ops-queue-titleplate-grid"
                    aria-hidden
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-400/22 to-purple-950/0 opacity-70 pointer-events-none rounded-[inherit]" />
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/22 to-transparent pointer-events-none z-[1]" />
                  <div className="absolute bottom-0 left-4 right-4 md:left-8 md:right-8 h-px bg-gradient-to-r from-transparent via-violet-400/35 to-transparent pointer-events-none z-[1]" />

                  <div className="relative z-[2] min-w-0 w-full">
                    <p className="ops-queue-titleplate-orbitron text-[8px] md:text-[9px] uppercase tracking-[0.22em] md:tracking-[0.32em] text-violet-300 mb-1.5 font-semibold leading-tight">
                      Live dispatch · today&apos;s stops
                    </p>
                    <h1 className="ops-queue-titleplate-orbitron ops-queue-titleplate-title-glow text-[1.0625rem] sm:text-xl md:text-2xl font-black uppercase tracking-[0.06em] sm:tracking-[0.1em] md:tracking-[0.14em] leading-none text-white">
                      Mission Queue
                    </h1>
                    <div className="mt-2 md:mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <div className="h-px w-10 md:w-16 shrink-0 bg-gradient-to-r from-violet-300 to-transparent" />
                      <span className="ops-queue-titleplate-orbitron text-white/45 text-[9px] md:text-[10px] tracking-[0.12em] md:tracking-[0.18em] uppercase">
                        Online
                        <span className="mx-2 text-white/25">/</span>
                        {filteredAppointments.length} Stop{filteredAppointments.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/*
                 * Date selector (prev / date input / next) — intentionally removed; Mission Queue is today-only.
                 * To restore: useState yyyy-MM-dd, row with ‹ input type="date" › wired to setDate.
                 */}

                <div className="space-y-2">
                  {!isTechnician && (
                    <select
                      value={selectedTechId}
                      onChange={(e) => setSelectedTechId(e.target.value)}
                      className="w-full rounded-lg px-3 py-2.5 text-sm text-white"
                      style={{ background: '#0D1525', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <option value="">All Technicians</option>
                      {technicians.map(tech => (
                        <option key={tech.id} value={tech.id}>{getTechName(tech)}</option>
                      ))}
                    </select>
                  )}

                  <input
                    type="text"
                    placeholder="Search by work order #..."
                    value={searchWO}
                    onChange={(e) => setSearchWO(e.target.value)}
                    className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-500"
                    style={{ background: '#0D1525', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              </div>
            </div>

            <div>
              {isLoading ? (
                <div className="flex justify-center py-16">
                  <LoadingSpinner />
                </div>
              ) : error ? (
                <div className="py-16 text-center text-red-400">{error}</div>
              ) : filteredAppointments.length === 0 ? (
                <div className="py-16 text-center">
                  <FaCalendarAlt className="mx-auto mb-4 h-12 w-12 text-gray-600" />
                  <p className="font-medium text-gray-400">No appointments today</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {selectedTechId ? 'Try selecting a different technician.' : 'Check back later for appointments.'}
                  </p>
                </div>
              ) : (
                filteredAppointments.map((apt, i) => (
                  <AppointmentCard
                    key={apt.id || i}
                    appointment={apt}
                    railColor={
                      apt.technician_id
                        ? techRailMap[String(apt.technician_id)] || NEON_RAILS[0]
                        : RAIL_FALLBACK
                    }
                    onStatusChange={(id, status) => {
                      setAppointments(prev =>
                        prev.map(a => a.id === id ? { ...a, status } : a)
                      );
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default TodaysRoute;

TodaysRoute.getLayout = (page) => <TechDashboardLayout>{page}</TechDashboardLayout>;

export async function getServerSideProps() {
  return { props: {} };
}
