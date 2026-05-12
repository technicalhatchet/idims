import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import Link from 'next/link';
import { format } from 'date-fns';
import TechDashboardLayout from '../../components/layouts/TechDashboardLayout';
import ApplianceIcon from '../../components/ui/ApplianceIcon';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import StatusBadge from '../../components/ui/StatusBadge';
import { apiClient } from '../../utils/api-client';
import { getUserRole } from '../../utils/auth0-helpers';
import { FaPhone, FaMapMarkerAlt, FaCalendarAlt, FaChevronDown, FaChevronUp, FaArrowLeft, FaClock, FaUser } from 'react-icons/fa';
import { NEON_RAILS } from '../../components/schedule/ScheduleTestTimeline';

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

  return (
    <>
      <Head>
        <title>Mission Queue | IDIMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <style>{`
          header, nav, .header-bar, [class*='h-16'] {
            background-color: #0D1525 !important;
            border-bottom: 1px solid rgba(255,255,255,0.07) !important;
          }
        `}</style>
      </Head>

      <div className="min-h-screen pb-8" style={{ background: '#0A0F1E' }}>
        <div className="max-w-lg mx-auto px-4 py-5">
          <div
            className="sticky z-[1100] -mx-4 px-4 pt-2 pb-3 mb-4 top-[72px]"
            style={{
              background: 'linear-gradient(180deg, #0A0F1E 0%, #0A0F1E 88%, rgba(10,15,30,0) 100%)',
            }}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <div className="relative mb-1 inline-block">
                  <h1 className="flex flex-wrap items-center gap-2 text-[1.35rem] font-black leading-none tracking-[0.04em]">
                    <span
                      style={{
                        color: '#67E8F9',
                        textShadow:
                          '0 0 22px rgba(34,211,238,0.55), 0 0 2px rgba(34,211,238,1), 0 0 40px rgba(34,211,238,0.18)',
                      }}
                    >
                      Mission
                    </span>
                    <span
                      className="inline-block h-[0.92em] w-px shrink-0 self-center"
                      style={{
                        background: 'linear-gradient(180deg, transparent, rgba(34,211,238,0.55), transparent)',
                        boxShadow: '0 0 12px rgba(34,211,238,0.45)',
                      }}
                      aria-hidden
                    />
                    <span
                      className="text-white font-extrabold tracking-[0.02em]"
                      style={{
                        textShadow: '0 0 14px rgba(255,122,0,0.12), 0 0 1px rgba(255,255,255,0.25)',
                      }}
                    >
                      Queue
                    </span>
                  </h1>
                  <div
                    className="pointer-events-none mt-2 h-[2px] w-[min(10rem,60%)] rounded-full opacity-85"
                    style={{
                      background: 'linear-gradient(90deg, rgba(34,211,238,0.95), rgba(255,122,0,0.85), transparent)',
                      boxShadow: '0 0 14px rgba(34,211,238,0.35), 0 0 8px rgba(255,122,0,0.2)',
                    }}
                    aria-hidden
                  />
                </div>
                <p className="text-sm text-gray-500 mt-3">
                  <span className="text-gray-400">Today</span>
                  <span className="text-gray-600">{' · '}</span>
                  {scheduleDateDisplay}
                  <span className="text-gray-600">{' · '}</span>
                  {filteredAppointments.length} stop{filteredAppointments.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Link
                href="/techdashboard"
                className="flex flex-shrink-0 items-center gap-1 text-xs text-gray-500 hover:text-cyan-400"
              >
                <FaArrowLeft className="text-[10px]" />
                <span>Dashboard</span>
              </Link>
            </div>

            {/*
             * Date selector (prev / date input / next) — intentionally removed; Mission Queue is today-only.
             * To restore: useState yyyy-MM-dd, row with ‹ input type="date" › wired to setDate.
             */}

            {!isTechnician && (
              <select
                value={selectedTechId}
                onChange={(e) => setSelectedTechId(e.target.value)}
                className="mb-2 w-full rounded-lg px-3 py-2.5 text-sm text-white"
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
    </>
  );
}

export default TodaysRoute;

TodaysRoute.getLayout = (page) => <TechDashboardLayout>{page}</TechDashboardLayout>;

export async function getServerSideProps() {
  return { props: {} };
}
