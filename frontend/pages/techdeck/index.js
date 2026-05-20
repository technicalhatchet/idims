import { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { format, isToday, isFuture } from 'date-fns';
import { useUser } from '@auth0/nextjs-auth0/client';
import TechDashboardLayout from '../../components/layouts/TechDashboardLayout';
import { useHudGridDoubleTapRail } from '../../hooks/useHudGridDoubleTapRail';
import StatusBadge from '../../components/ui/StatusBadge';
import { apiClient } from '../../utils/api-client';
import { getEquipmentIconKey } from '../../utils/equipment-icon-key';

/** Fractal noise texture for outer tactical HUD shell (low-opacity overlay) */
const TECHBOARD_TACTICAL_NOISE_BG =
  'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")';

/** Match tactical field grid (`bg-[size:42px_42px]`). */
const HUD_GRID_STEP = 42;
/** Subpixel / DPR tweak — same as partswait / headertest. */
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

// ── Appliance Icons (same as work orders test) ────────────────────────────
const APPLIANCE_ICONS = {
  refrigerator:   { color: 'cyan',   svg: (<><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="6" y1="10" x2="18" y2="10"/><line x1="10" y1="5" x2="10" y2="8"/><line x1="10" y1="13" x2="10" y2="16"/></>) },
  fridge:         { color: 'cyan',   svg: (<><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="6" y1="10" x2="18" y2="10"/><line x1="10" y1="5" x2="10" y2="8"/><line x1="10" y1="13" x2="10" y2="16"/></>) },
  washingmachine: { color: 'cyan',   svg: (<><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><circle cx="12" cy="13" r="2"/><circle cx="8" cy="6" r="1"/></>) },
  washer:         { color: 'cyan',   svg: (<><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><circle cx="12" cy="13" r="2"/><circle cx="8" cy="6" r="1"/></>) },
  dryer:          { color: 'orange', svg: (<><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><path d="M10 11a2 2 0 0 0 4 0"/><circle cx="8" cy="6" r="1"/></>) },
  dishwasher:     { color: 'cyan',   svg: (<><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="4" y1="8" x2="20" y2="8"/><line x1="9" y1="5" x2="15" y2="5"/></>) },
  oven:           { color: 'orange', svg: (<><rect x="4" y="2" width="16" height="20" rx="2"/><rect x="6" y="10" width="12" height="9" rx="1"/><line x1="7" y1="6" x2="7" y2="6"/><line x1="10" y1="6" x2="10" y2="6"/><line x1="13" y1="6" x2="13" y2="6"/><line x1="16" y1="6" x2="16" y2="6"/></>) },
  microwave:      { color: 'orange', svg: (<><rect x="2" y="6" width="20" height="12" rx="2"/><rect x="4" y="8" width="12" height="8"/><line x1="18" y1="10" x2="18" y2="10"/><line x1="18" y1="12" x2="18" y2="12"/><line x1="18" y1="14" x2="18" y2="14"/></>) },
  freezer:        { color: 'cyan',   svg: (<><rect x="3" y="6" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="6" x2="12" y2="10"/></>) },
  cooktop:        { color: 'orange', svg: (<><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><circle cx="16" cy="10" r="2"/><circle cx="8" cy="16" r="2"/><circle cx="16" cy="16" r="2"/></>) },
  tv:             { color: 'orange', svg: (<><rect x="2" y="4" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="18" x2="12" y2="21"/></>) },
  default:        { color: 'cyan',   svg: (<><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></>) },
};

function ApplianceIcon({ equipmentType, equipmentSubtype, size = 'md' }) {
  const key = getEquipmentIconKey(equipmentType, equipmentSubtype);
  const match = APPLIANCE_ICONS[key] || APPLIANCE_ICONS.default;
  const isCyan = match.color === 'cyan';
  const sz = size === 'lg' ? 'w-12 h-12' : 'w-9 h-9';
  return (
    <svg viewBox="0 0 24 24" className={sz} style={{
      stroke: isCyan ? '#00D4FF' : '#FF7A00', strokeWidth: 1.5, fill: 'none',
      strokeLinecap: 'round', strokeLinejoin: 'round',
      filter: isCyan ? 'drop-shadow(0 0 6px rgba(0,212,255,0.6))' : 'drop-shadow(0 0 6px rgba(255,122,0,0.6))'
    }}>{match.svg}</svg>
  );
}

// ── Stat Card with Glass Effect + Sweep Animation ─────────────────────────
function StatCard({ icon, label, value, sub, subColor = '#22D3EE', borderColor = 'rgba(34,211,238,0.3)', sweepColor = 'cyan', href }) {
  const [sweeping, setSweeping] = useState(false);
  const router = useRouter();

  // Color configs for sweep effect
  const colorConfigs = {
    cyan: { sweep: 'rgba(0, 212, 255, 0.4)', glow: 'rgba(0, 212, 255, 0.6)', border: 'rgba(34, 211, 238, 0.7)' },
    orange: { sweep: 'rgba(255, 122, 0, 0.4)', glow: 'rgba(255, 122, 0, 0.6)', border: 'rgba(255, 122, 0, 0.7)' },
  };
  const colors = colorConfigs[sweepColor] || colorConfigs.cyan;

  const handleClick = (e) => {
    if (!href) return;
    e.preventDefault();
    setSweeping(true);
    // Delay navigation to show the sweep animation
    setTimeout(() => {
      router.push(href);
    }, 600);
  };

  return (
    <div 
      className={`tech-glass-card tech-hover-lift ${sweeping ? 'tech-sweep-active' : ''}`}
      onClick={handleClick}
      style={{ cursor: href ? 'pointer' : 'default' }}
      data-sweep-color={sweepColor}
      data-techboard-card
    >
      <div className="flex items-center gap-3 p-4 rounded-lg h-full relative overflow-hidden"
        style={{ 
          border: `1px solid ${borderColor}`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] z-0"
          style={{
            background: 'rgba(13, 21, 37, 0.001)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
          aria-hidden
        />
        {/* Sweep overlay - color matched */}
        <div 
          className="tech-sweep-overlay" 
          style={{ 
            background: sweeping 
              ? `linear-gradient(120deg, transparent 0%, ${colors.sweep} 50%, transparent 100%)` 
              : undefined 
          }} 
        />
        
        <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 relative z-10 tech-icon-wrap" style={{ background: '#080C14' }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0 relative z-10">
          <p className="text-xs text-gray-400 mb-0.5">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {sub && <p className="text-xs mt-0.5" style={{ color: subColor }}>{sub}</p>}
        </div>
        <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0 text-gray-600 relative z-10" style={{ stroke: 'currentColor', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </div>
  );
}

// ── EST time helper ─────────────────────────────────────────────────────
/**
 * Parse API schedule timestamps (combined schedule uses `start` from datetime.isoformat()).
 * Append `Z` only when the string has no timezone — appending Z to `...+00:00` breaks parsing (NaN)
 * and leaves lists in DB order so "next job" can pick the wrong row.
 */
function parseScheduleUtcMs(raw) {
  const s = String(raw || '').trim();
  if (!s) return NaN;
  const hasExplicitZone =
    /z$/i.test(s)
    || /[+-]\d{2}:\d{2}$/.test(s)
    || /[+-]\d{4}$/.test(s);
  const normalized = hasExplicitZone ? s : `${s}Z`;
  const t = Date.parse(normalized);
  return Number.isFinite(t) ? t : NaN;
}

function toEST(dateStr) {
  if (!dateStr) return '';
  const ms = parseScheduleUtcMs(dateStr);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });
}

/** Instant (ms) for sorting / next-job — prefers scheduled_start then start (combined schedule). */
function appointmentStartMs(apptOrStartField) {
  const raw =
    typeof apptOrStartField === 'string'
      ? apptOrStartField
      : apptOrStartField?.scheduled_start || apptOrStartField?.start || '';
  return parseScheduleUtcMs(raw);
}

function normalizeWorkOrderStatus(status) {
  return String(status || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

/** Work-order statuses that mean the job is waiting on parts (list API rarely includes nested `parts[]`). */
const WO_PARTS_HOLD_STATUSES = new Set(['waiting_on_parts', 'parts_on_order']);

/** Appointments fully done for today — omit from "next job" card. */
function isAppointmentDoneStatus(status) {
  const n = normalizeWorkOrderStatus(status);
  return (
    n === 'completed'
    || n === 'cancelled'
    || n === 'canceled'
    || n === 'completed_pending_payment'
    || n === 'paid'
    || n === 'expired'
  );
}

function isActivelyDeployedStatus(status) {
  const n = normalizeWorkOrderStatus(status);
  return n === 'in_progress' || n === 'en_route';
}

/**
 * Next job card: unfinished work today — row `status` should already reflect work-order
 * status when available (see load). Active job first, then earliest incomplete ≥ now, else earliest remaining.
 */
function pickNextJobToday(sortedTodayAppts) {
  const now = Date.now();
  const incomplete = sortedTodayAppts.filter((a) => !isAppointmentDoneStatus(a.status));
  const working = incomplete.find((a) => isActivelyDeployedStatus(a.status));
  if (working) return working;
  const upcoming = incomplete.find((a) => appointmentStartMs(a) >= now);
  if (upcoming) return upcoming;
  return incomplete[0] ?? null;
}

// ── Route Button with Glass Effect + Sweep Animation ─────────────────────
function RouteButton() {
  const [sweeping, setSweeping] = useState(false);
  const router = useRouter();

  const handleClick = (e) => {
    e.preventDefault();
    setSweeping(true);
    setTimeout(() => {
      router.push('/techdashboard/route');
    }, 600);
  };

  return (
    <div
      className={`tech-glass-card tech-hover-lift ${sweeping ? 'tech-sweep-active' : ''}`}
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
      data-techboard-card
    >
      <div
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium relative overflow-hidden"
        style={{
          background: 'rgba(13, 21, 37, 0.25)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(34,211,238,0.4)',
          color: '#22D3EE',
        }}
      >
        <div className="tech-sweep-overlay" />
        <svg viewBox="0 0 24 24" className="w-4 h-4 relative z-10" style={{ stroke: '#22D3EE', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: 'drop-shadow(0 0 4px rgba(0,212,255,0.7))' }}>
          <polygon points="3 11 22 2 13 21 11 13 3 11"/>
        </svg>
        <span className="relative z-10">Route</span>
      </div>
    </div>
  );
}

// ── Critical Mass Card with Glass Effect + Sweep Animation ───────────────
function CriticalMassCard({ count }) {
  const [sweeping, setSweeping] = useState(false);
  const router = useRouter();
  const isActive = count > 0;

  const handleClick = (e) => {
    e.preventDefault();
    setSweeping(true);
    setTimeout(() => {
      router.push('/work_orders/mass');
    }, 600);
  };

  return (
    <div
      className={`tech-glass-card tech-hover-lift mb-4 ${sweeping ? 'tech-sweep-active' : ''} ${isActive ? 'tech-breathing-pulse' : ''}`}
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
      data-sweep-color={isActive ? 'orange' : 'cyan'}
      data-techboard-card
    >
      <div
        className="relative flex items-center gap-4 p-4 rounded-lg overflow-hidden"
        style={{ 
          background: 'rgba(13, 21, 37, 0.25)', 
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: isActive ? '1px solid rgba(251,146,60,0.6)' : '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Sweep overlay */}
        <div 
          className="tech-sweep-overlay" 
          style={{ 
            background: sweeping 
              ? `linear-gradient(120deg, transparent 0%, ${isActive ? 'rgba(251, 146, 60, 0.4)' : 'rgba(0, 212, 255, 0.4)'} 50%, transparent 100%)` 
              : undefined 
          }} 
        />
        
        {isActive && (
          <div className="absolute inset-0 rounded-lg" style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(251,146,60,0.1) 0%, transparent 60%), radial-gradient(ellipse at 100% 0%, rgba(251,146,60,0.1) 0%, transparent 60%), radial-gradient(ellipse at 0% 100%, rgba(251,146,60,0.1) 0%, transparent 60%), radial-gradient(ellipse at 100% 100%, rgba(251,146,60,0.1) 0%, transparent 60%)' }} />
        )}
        <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 relative z-10 tech-icon-wrap" style={{ background: '#080C14' }}>
          <svg viewBox="0 0 24 24" className="w-7 h-7" style={{
            stroke: isActive ? '#FB923C' : '#374151',
            strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round',
            filter: isActive ? 'drop-shadow(0 0 6px rgba(251,146,60,0.8))' : 'none'
          }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0 relative z-10">
          <p className="text-sm font-bold" style={{ color: isActive ? '#FB923C' : '#6B7280', textShadow: isActive ? '0 0 8px rgba(251,146,60,0.5)' : 'none' }}>
            Critical Mass
          </p>
          <p className="text-xs mt-0.5" style={{ color: isActive ? '#9CA3AF' : '#4B5563' }}>
            {isActive
              ? `${count} order${count > 1 ? 's' : ''} past scheduled date — needs attention`
              : 'All clear — no overdue orders'}
          </p>
        </div>
        <div className="flex-shrink-0 relative z-10">
          <p className="text-2xl font-bold" style={{ color: isActive ? '#FB923C' : '#374151' }}>
            {count}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Next Job Card (flat spotlight + link to work order mobile + sweep on tap) ───────────────
function NextJobCard({ job }) {
  const [sweeping, setSweeping] = useState(false);
  const [showCallOptions, setShowCallOptions] = useState(false);
  const router = useRouter();

  const handleCardClick = (e) => {
    e.preventDefault();
    setSweeping(true);
    setTimeout(() => {
      router.push(`/work_orders/${job.work_order_id}/mobile`);
    }, 600);
  };

  const handleCallClick = (e) => {
    e.stopPropagation();
    const hasClientPhone = Boolean(job.client_phone);
    const hasTenantPhone = Boolean(job.tenant_phone);
    
    console.log('[Call Button] Debug:', {
      client_phone: job.client_phone,
      tenant_phone: job.tenant_phone,
      tenant_name: job.tenant_name,
      hasClientPhone,
      hasTenantPhone,
      property: job.property
    });
    
    // If both phones available, show options
    if (hasClientPhone && hasTenantPhone) {
      console.log('[Call Button] Showing options modal');
      setShowCallOptions(true);
    } else if (hasClientPhone) {
      // Call client directly
      console.log('[Call Button] Calling client directly');
      window.location.href = `tel:${job.client_phone}`;
    } else if (hasTenantPhone) {
      // Call tenant directly
      console.log('[Call Button] Calling tenant directly');
      window.location.href = `tel:${job.tenant_phone}`;
    }
  };

  return (
    <div 
      className={`mb-4 rounded-lg tech-next-job-card ${sweeping ? 'tech-sweep-active' : ''}`} 
      data-techboard-card
      onClick={handleCardClick}
      style={{ cursor: 'pointer' }}
    >
      <div className="rounded-lg relative overflow-hidden" style={{ background: 'rgba(13, 21, 37, 0.25)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(34,211,238,0.35)' }}>
        {/* Sweep overlay */}
        <div 
          className="tech-sweep-overlay" 
          style={{ 
            background: sweeping 
              ? 'linear-gradient(120deg, transparent 0%, rgba(0, 212, 255, 0.4) 50%, transparent 100%)' 
              : undefined 
          }} 
        />
        
        <div className="block p-4 relative z-10">
          <div className="flex justify-between items-start mb-3">
            <p className="text-xs font-medium text-cyan-400 tracking-wider uppercase">Next Job</p>
            <StatusBadge status={job.status} />
          </div>
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 tech-icon-wrap" style={{ background: '#080C14', border: '1px solid rgba(255,255,255,0.07)' }}>
              <ApplianceIcon
                equipmentType={job.equipment_type}
                equipmentSubtype={job.equipment_subtype}
                size="lg"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-white">
                Today at {job.scheduled_start ? toEST(job.scheduled_start) : 'TBD'}
              </p>
              <p className="text-sm font-medium text-white mt-0.5">{job.client_name || 'Unknown Client'}</p>
              <p className="text-xs text-gray-400">{[job.equipment_make, job.equipment_model].filter(Boolean).join(' ') || 'Appliance'}</p>
              <div className="flex items-center gap-1 mt-1">
                <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" style={{ stroke: '#6B7280', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                <p className="text-xs text-gray-500 truncate">{job.service_address || job.client_address || 'Address on file'}</p>
              </div>
            </div>
          </div>
        </div>

        {(job.client_phone || job.tenant_phone || job.status === 'scheduled') && (
          <div className="px-4 pb-4 pt-2 space-y-3 relative z-10" onClick={(e) => e.stopPropagation()}>
            {(job.client_phone || job.tenant_phone) && (
              <div className="relative" onClick={(e) => {
                // Close modal if clicking on the wrapper but not on the modal itself
                if (showCallOptions && e.target === e.currentTarget) {
                  e.stopPropagation();
                  setShowCallOptions(false);
                }
              }}>
                <button
                  type="button"
                  onClick={handleCallClick}
                  className="tech-btn-glow flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium overflow-hidden relative"
                  style={{ background: 'rgba(13, 21, 37, 0.25)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(34,211,238,0.3)', color: '#22D3EE' }}
                >
                  <span className="tech-btn-sweep" />
                  <svg viewBox="0 0 24 24" className="w-4 h-4 relative z-10" style={{ stroke: '#22D3EE', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4A2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  <span className="relative z-10">Call</span>
                </button>
                
                {/* Call options modal */}
                {showCallOptions && (
                  <div 
                    className="absolute bottom-full left-0 right-0 mb-2 rounded-lg overflow-hidden z-50"
                    style={{ background: 'rgba(13, 21, 37, 0.95)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(34,211,238,0.4)', boxShadow: '0 0 20px rgba(0,212,255,0.3)' }}
                  >
                    <div className="p-2 space-y-1">
                      {job.client_phone && (
                        <a
                          href={`tel:${job.client_phone}`}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-cyan-500/10 active:bg-cyan-500/20 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowCallOptions(false);
                          }}
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" style={{ stroke: '#22D3EE', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium">Call Owner</p>
                            <p className="text-xs text-gray-400 truncate">{job.client_name || 'Client'}</p>
                          </div>
                        </a>
                      )}
                      {job.tenant_phone && (
                        <a
                          href={`tel:${job.tenant_phone}`}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-cyan-500/10 active:bg-cyan-500/20 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowCallOptions(false);
                          }}
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" style={{ stroke: '#22D3EE', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9 22 9 12 15 12 15 22"/>
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium">Call Tenant</p>
                            <p className="text-xs text-gray-400 truncate">{job.tenant_name || 'At property'}</p>
                          </div>
                        </a>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCallOptions(false);
                      }}
                      className="w-full px-3 py-2 text-xs text-gray-400 hover:text-white border-t border-white/10 hover:bg-white/5 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
            {job.status === 'scheduled' && (
              <div onClick={(e) => e.stopPropagation()}>
                <EnRouteButton
                  workOrderId={job.work_order_id}
                  appointmentId={job.id}
                  onSuccess={() => window.location.reload()}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Today Job Row ─────────────────────────────────────────────────────────
function TodayJobRow({ appt }) {
  const timeStr = appt.scheduled_start ? toEST(appt.scheduled_start).split(' ')[0] : '--:--';
  const ampm = appt.scheduled_start ? toEST(appt.scheduled_start).split(' ')[1] : '';
  const client = appt.client_name || 'Unknown Client';
  const equip = [appt.equipment_make, appt.equipment_model].filter(Boolean).join(' ') || appt.equipment_type || 'Appliance';
  const address = appt.service_address || appt.client_address || '';

  return (
    <Link href={`/work_orders/${appt.work_order_id}`} className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      {/* Time block */}
      <div className="flex-shrink-0 w-12 text-right">
        <p className="text-sm font-bold text-cyan-400">{timeStr}</p>
        <p className="text-xs text-gray-500">{ampm}</p>
      </div>
      {/* Divider */}
      <div className="flex-shrink-0 w-px self-stretch bg-cyan-500/30 mx-1" />
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{client}</p>
        <p className="text-xs text-gray-400 truncate">{equip}</p>
        {address && (
          <div className="flex items-center gap-1 mt-0.5">
            <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" style={{ stroke: '#6B7280', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <p className="text-xs text-gray-500 truncate">{address}</p>
          </div>
        )}
      </div>
      {/* Status */}
      <div className="flex-shrink-0">
        <StatusBadge status={appt.status} />
      </div>
    </Link>
  );
}

// ── En Route Button ─────────────────────────────────────────────────────
function EnRouteButton({ workOrderId, appointmentId, onSuccess }) {
  const [loading, setLoading] = useState(false);

  const handleEnRoute = async () => {
    setLoading(true);
    try {
      let id = appointmentId;
      if (!id && workOrderId) {
        const apptRes = await apiClient(`work-orders/${workOrderId}/appointments`);
        id = apptRes?.items?.[0]?.id;
      }
      if (!id) {
        alert('Could not find an appointment to update.');
        return;
      }
      await apiClient(`work-orders/appointments/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'en_route' }),
      });
      onSuccess?.();
    } catch (e) {
      alert('Failed to update appointment status: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleEnRoute}
      disabled={loading}
      className="tech-btn-glow tech-btn-glow-orange flex items-center justify-center w-full py-2.5 rounded-lg text-sm font-medium overflow-visible relative disabled:opacity-60"
      style={{
        background: 'rgba(13, 21, 37, 0.25)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,122,0,0.35)',
        color: '#FF7A00',
      }}
    >
      <span className="tech-btn-sweep tech-btn-sweep-orange" />
      {/*
        Same footprint as Call (w-4 icon + gap-2): keeps horizontal center math identical.
        Slight slide left (~½ the label width delta) lines 'En Route' up under 'Call Customer'.
      */}
      <span className="relative z-10 flex items-center gap-2 -translate-x-[0.6875rem]">
        {/* 48×48 art: right-aligned in the w-4 slot so bleed goes left into margin, not over the label */}
        <span className="relative inline-flex h-4 w-4 shrink-0 overflow-visible pointer-events-none">
          <img
            src="/arvan.png"
            alt=""
            width={48}
            height={48}
            className="absolute right-0 top-1/2 h-12 w-12 max-w-none -translate-y-1/2 object-contain object-right"
            style={{ filter: 'drop-shadow(0 0 4px rgba(255,122,0,0.75))' }}
            aria-hidden
          />
        </span>
        <span style={{ color: '#FF7A00', textShadow: '0 0 8px rgba(255,122,0,0.45)' }}>
          {loading ? 'Updating...' : 'En Route'}
        </span>
      </span>
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function TechDashboardTest() {
  const { user } = useUser();
  const gridTapLayerRef = useHudGridDoubleTapRail();
  const [schedule, setSchedule] = useState([]);
  const [workOrderStats, setWorkOrderStats] = useState({ total: 0, today: 0, completed_today: 0, partsWaiting: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const tacticalColumnRef = useRef(null);
  const titleplateRef = useRef(null);
  const [hudGridShift, setHudGridShift] = useState({ x: 0, y: 0 });
  /** Avoid SSR/client mismatch on greeting, date, and Auth0 name (React #425/#418). */
  const [headerReady, setHeaderReady] = useState(false);

  useEffect(() => {
    setHeaderReady(true);
  }, []);

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

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const nextWeekStr = format(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

  useEffect(() => {
    async function load() {
      try {
        const [schedData, woData, woItems] = await Promise.all([
          apiClient(`scheduling/schedule/combined?start_date=${todayStr}&end_date=${nextWeekStr}&view_type=day`),
          apiClient(`work-orders?page=1&limit=1`),
          apiClient(`work-orders?page=1&limit=200`),
        ]);
        const appts = schedData?.appointments || schedData?.schedule || schedData?.data || [];
        const statusByWorkOrderId = {};
        for (const w of woItems?.items || []) {
          statusByWorkOrderId[String(w.id)] = w.status;
        }
        const filtered = (Array.isArray(appts) ? appts : []).filter(a => {
          const startField = a.scheduled_start || a.start;
          if (!startField) return false;
          const ms = parseScheduleUtcMs(startField);
          if (!Number.isFinite(ms)) return false;
          return isToday(new Date(ms));
        });
        setSchedule(filtered.map(a => {
          const wid = a.work_order_id != null ? String(a.work_order_id) : '';
          const woStatus = wid ? statusByWorkOrderId[wid] : undefined;
          const mergedStatus =
            woStatus != null && String(woStatus).trim() !== '' ? woStatus : a.status;
          return {
            ...a,
            scheduled_start: a.scheduled_start || a.start,
            status: mergedStatus,
            service_address: a.service_address || a.location || a.service_location?.address || '',
            client_phone: a.client_phone || a.client?.phone || '',
            client_name: a.client_name || a.client?.name || '',
            tenant_phone: a.property?.tenant_phone || a.tenant_phone || '',
            tenant_name: a.property?.tenant_name || a.tenant_name || '',
            equipment_type: a.equipment_type || '',
            equipment_subtype: a.equipment_subtype || '',
            equipment_make: a.equipment_make || '',
            equipment_model: a.equipment_model || '',
          };
        }));
        const allItems = woItems?.items || [];
        const todayItems = allItems.filter(w => {
          if (!w.scheduled_start) return false;
          const ms = parseScheduleUtcMs(w.scheduled_start);
          if (!Number.isFinite(ms)) return false;
          return isToday(new Date(ms));
        });
        const partsWaiting = allItems.filter((w) => {
          const st = normalizeWorkOrderStatus(w.status);
          if (WO_PARTS_HOLD_STATUSES.has(st)) return true;
          return (
            Array.isArray(w.parts) &&
            w.parts.some((p) => ['ordered', 'needed'].includes(p.status))
          );
        }).length;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(23, 59, 59, 999);
        const criticalMass = allItems.filter(w => {
          if (!['scheduled', 'pending', 'en_route'].includes(w.status)) return false;
          if (!w.scheduled_start) return false;
          const ms = parseScheduleUtcMs(w.scheduled_start);
          if (!Number.isFinite(ms)) return false;
          return new Date(ms) <= yesterday;
        }).length;

        setWorkOrderStats({
          total: woData?.total || 0,
          today: todayItems.length,
          completed_today: todayItems.filter(w => w.status === 'completed').length,
          partsWaiting,
          criticalMass,
        });
      } catch (e) {
        console.error('Dashboard load error:', e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [todayStr, nextWeekStr]);

  const todayAppts = schedule
    .filter((a) => {
      const startField = a.scheduled_start || a.start;
      if (!startField) return false;
      const ms = parseScheduleUtcMs(startField);
      if (!Number.isFinite(ms)) return false;
      return isToday(new Date(ms));
    })
    .sort((a, b) => {
      const ta = appointmentStartMs(a);
      const tb = appointmentStartMs(b);
      const aOk = Number.isFinite(ta);
      const bOk = Number.isFinite(tb);
      if (aOk && bOk && ta !== tb) return ta - tb;
      if (aOk && !bOk) return -1;
      if (!aOk && bOk) return 1;
      const ida = String(a.work_order_id || a.id || '');
      const idb = String(b.work_order_id || b.id || '');
      return ida.localeCompare(idb);
    });

  const upcomingAppts = schedule.filter(a => {
    const startField = a.scheduled_start || a.start;
    if (!startField) return false;
    const ms = parseScheduleUtcMs(startField);
    if (!Number.isFinite(ms)) return false;
    const d = new Date(ms);
    return isFuture(d) && !isToday(d);
  }).sort((a, b) => appointmentStartMs(a) - appointmentStartMs(b));

  const nextJob = pickNextJobToday(todayAppts);

  const titleplateFirstName = headerReady
    ? (user?.given_name || user?.name?.split(' ')[0] || 'Tech')
    : 'Tech';
  const titleplateGreeting = headerReady ? getGreeting() : 'morning';
  const titleplateDateLabel = headerReady
    ? format(new Date(), 'EEEE, MMMM d, yyyy')
    : '\u00a0';

  return (
    <>
      <Head>
        <title>Tech Board | Atomic Repair</title>
        <meta name="description" content="Atomic Repair technician board" />
        <meta name="theme-color" content="#22D3EE" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Tech Board" />
        <link rel="manifest" href="/manifest-techboard.json" />
        <link rel="apple-touch-icon" href="/icons/qrbgicon-192x192.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <style>{`
          @keyframes techboard-tactical-scan {
            0% { left: -48%; }
            100% { left: 115%; }
          }
          @keyframes techboard-titleplate-scan {
            100% { left: 120%; }
          }
          .techboard-titleplate-grid {
            background-image:
              linear-gradient(rgba(0, 217, 255, 0.07) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 217, 255, 0.07) 1px, transparent 1px);
            background-size: ${HUD_GRID_STEP}px ${HUD_GRID_STEP}px;
            background-position: var(--techboard-hud-grid-x, 0px) var(--techboard-hud-grid-y, 0px);
          }
          .techboard-titleplate-orbitron {
            font-family: 'Orbitron', system-ui, sans-serif;
          }
          .techboard-titleplate-title-glow {
            text-shadow:
              0 0 8px rgba(255, 255, 255, 0.15),
              0 0 18px rgba(34, 211, 238, 0.35),
              0 0 40px rgba(0, 212, 255, 0.22);
          }
          .techboard-titleplate-edge {
            position: relative;
          }
          .techboard-titleplate-edge::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            padding: 1px;
            background: linear-gradient(
              135deg,
              rgba(34, 211, 238, 0.72),
              rgba(8, 51, 68, 0.28),
              rgba(0, 212, 255, 0.5)
            );
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            mask-composite: exclude;
            pointer-events: none;
          }
          .techboard-titleplate-scan::after {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(34, 211, 238, 0.085),
              transparent
            );
            animation: techboard-titleplate-scan 5s linear infinite;
            border-radius: inherit;
            pointer-events: none;
          }
          /* Next job — flat spotlight (no hover/sweep on shell) */
          .tech-next-job-card {
            box-shadow:
              0 0 0 1px rgba(34, 211, 238, 0.12),
              0 0 20px rgba(0, 212, 255, 0.22),
              0 0 48px rgba(0, 212, 255, 0.1);
          }
          
          /* ── Tech Dashboard Glass Card System ── */
          .tech-glass-card {
            transition: transform 0.35s ease, box-shadow 0.35s ease;
          }
          
          .tech-glass-card:hover,
          .tech-glass-card:active {
            transform: translateY(-4px) scale(1.02);
          }
          
          /* Cyan cards (default) */
          .tech-glass-card:hover > div,
          .tech-glass-card:active > div {
            border-color: rgba(34, 211, 238, 0.5) !important;
            box-shadow: 
              0 0 8px rgba(0, 212, 255, 0.4),
              0 0 20px rgba(0, 212, 255, 0.2),
              0 0 40px rgba(0, 212, 255, 0.1);
          }
          
          .tech-glass-card:hover .tech-icon-wrap,
          .tech-glass-card:active .tech-icon-wrap {
            box-shadow: 
              0 0 8px rgba(0, 212, 255, 0.6),
              0 0 16px rgba(0, 212, 255, 0.3);
          }
          
          /* Orange cards */
          .tech-glass-card[data-sweep-color="orange"]:hover > div,
          .tech-glass-card[data-sweep-color="orange"]:active > div {
            border-color: rgba(255, 122, 0, 0.5) !important;
            box-shadow: 
              0 0 8px rgba(255, 122, 0, 0.4),
              0 0 20px rgba(255, 122, 0, 0.2),
              0 0 40px rgba(255, 122, 0, 0.1);
          }
          
          .tech-glass-card[data-sweep-color="orange"]:hover .tech-icon-wrap,
          .tech-glass-card[data-sweep-color="orange"]:active .tech-icon-wrap {
            box-shadow: 
              0 0 8px rgba(255, 122, 0, 0.6),
              0 0 16px rgba(255, 122, 0, 0.3);
          }
          
          /* Sweep overlay */
          .tech-sweep-overlay {
            position: absolute;
            inset: 0;
            background: linear-gradient(
              120deg,
              transparent 0%,
              rgba(0, 212, 255, 0.4) 50%,
              transparent 100%
            );
            opacity: 0;
            transform: translateX(-100%);
            pointer-events: none;
            z-index: 5;
            border-radius: inherit;
          }
          
          /* Sweep on tap/click (cyan default) */
          .tech-sweep-active .tech-sweep-overlay {
            opacity: 1;
            animation: tech-sweep 0.6s ease-out forwards;
          }
          
          .tech-sweep-active > div {
            border-color: rgba(34, 211, 238, 0.7) !important;
            box-shadow: 
              0 0 12px rgba(0, 212, 255, 0.6),
              0 0 30px rgba(0, 212, 255, 0.4),
              0 0 60px rgba(0, 212, 255, 0.2) !important;
          }
          
          /* Sweep on tap/click (orange) */
          .tech-sweep-active[data-sweep-color="orange"] > div {
            border-color: rgba(255, 122, 0, 0.7) !important;
            box-shadow: 
              0 0 12px rgba(255, 122, 0, 0.6),
              0 0 30px rgba(255, 122, 0, 0.4),
              0 0 60px rgba(255, 122, 0, 0.2) !important;
          }
          
          @keyframes tech-sweep {
            0% { transform: translateX(-100%); opacity: 0.8; }
            100% { transform: translateX(100%); opacity: 0; }
          }
          
          /* Breathing pulse for Critical Mass */
          .tech-breathing-pulse > div {
            animation: tech-breathe 2.5s ease-in-out infinite;
          }
          
          @keyframes tech-breathe {
            0%, 100% { 
              box-shadow: 
                0 0 10px rgba(251, 146, 60, 0.2),
                0 0 20px rgba(251, 146, 60, 0.1);
            }
            50% { 
              box-shadow: 
                0 0 20px rgba(251, 146, 60, 0.4),
                0 0 40px rgba(251, 146, 60, 0.2),
                0 0 60px rgba(251, 146, 60, 0.1);
            }
          }
          
          /* Button glow + sweep effect */
          .tech-btn-glow {
            transition: all 0.3s ease;
          }
          
          .tech-btn-glow:hover,
          .tech-btn-glow:active {
            border-color: rgba(34, 211, 238, 0.6) !important;
            box-shadow: 
              0 0 8px rgba(0, 212, 255, 0.4),
              0 0 16px rgba(0, 212, 255, 0.2);
            transform: translateY(-1px);
          }
          
          .tech-btn-sweep {
            position: absolute;
            inset: 0;
            background: linear-gradient(
              120deg,
              transparent 0%,
              rgba(0, 212, 255, 0.3) 50%,
              transparent 100%
            );
            opacity: 0;
            transform: translateX(-100%);
            pointer-events: none;
            z-index: 5;
          }
          
          .tech-btn-glow:active .tech-btn-sweep {
            opacity: 1;
            animation: tech-sweep 0.5s ease-out forwards;
          }

          /* Orange variant (matches cyan tech-btn treatment) */
          .tech-btn-glow-orange:hover,
          .tech-btn-glow-orange:active {
            border-color: rgba(251, 146, 60, 0.65) !important;
            box-shadow:
              0 0 8px rgba(255, 122, 0, 0.35),
              0 0 16px rgba(255, 122, 0, 0.22);
            transform: translateY(-1px);
          }

          .tech-btn-sweep-orange {
            background: linear-gradient(
              120deg,
              transparent 0%,
              rgba(255, 122, 0, 0.32) 50%,
              transparent 100%
            );
          }

          .tech-btn-glow-orange:active .tech-btn-sweep-orange {
            opacity: 1;
            animation: tech-sweep 0.5s ease-out forwards;
          }
          
          /* Mobile touch feedback */
          @media (hover: none) {
            .tech-glass-card:active {
              transform: translateY(-2px) scale(1.01);
            }
            
            .tech-btn-glow:active {
              transform: translateY(-1px);
            }
          }
        `}</style>
      </Head>

      <div className="min-h-screen pb-24" style={{ background: '#0A0F1E' }}>
        <div
          ref={tacticalColumnRef}
          className="hud-tactical-column relative px-4 pt-0 pb-5 max-w-lg mx-auto min-h-screen"
        >
          {/* Tactical background — full column; same cyan grid stack as opsboard / mass / partswait */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute inset-0" style={{ background: '#0A0F1E' }} />
            <div
              className="absolute inset-0 opacity-[0.11]
                bg-[linear-gradient(rgba(0,217,255,.36)_1px,transparent_1px),linear-gradient(90deg,rgba(0,217,255,.28)_1px,transparent_1px)]
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
              style={{ backgroundImage: TECHBOARD_TACTICAL_NOISE_BG }}
            />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,.52)_100%)] pointer-events-none" />
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div
                className="absolute top-0 bottom-0 w-[42%]"
                style={{
                  left: '-48%',
                  background: 'linear-gradient(90deg, transparent 0%, transparent 32%, rgba(255,255,255,0.024) 50%, transparent 68%, transparent 100%)',
                  animation: 'techboard-tactical-scan 6.5s linear infinite',
                }}
              />
            </div>
            <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] pointer-events-none" />
          </div>

          <div
            ref={gridTapLayerRef}
            className="absolute inset-0 z-[1]"
            aria-hidden
          />

          <div className="hud-grid-content relative z-10 p-4 sm:p-6">

          {/* Page header — HUD titleplate (same shell as opsboard / mass / partswait) */}
          <div className="mb-5">
            <div
              ref={titleplateRef}
              className="relative overflow-hidden rounded-[18px] md:rounded-[22px] border border-cyan-400/35 bg-[rgba(5,12,22,.84)] backdrop-blur-2xl px-3.5 py-3 md:px-5 md:py-4 shadow-[0_0_30px_rgba(0,212,255,.28)] techboard-titleplate-edge techboard-titleplate-scan"
              data-techboard-card
              style={{
                ['--techboard-hud-grid-x']: `${hudGridShift.x}px`,
                ['--techboard-hud-grid-y']: `${hudGridShift.y}px`,
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-50 techboard-titleplate-grid"
                aria-hidden
              />
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-cyan-950/0 opacity-60 pointer-events-none rounded-[inherit]" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none z-[1]" />
              <div className="absolute bottom-0 left-4 right-4 md:left-8 md:right-8 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent pointer-events-none z-[1]" />

              <div className="relative z-[2] flex justify-between items-start gap-3 min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="techboard-titleplate-orbitron text-[8px] md:text-[9px] uppercase tracking-[0.2em] md:tracking-[0.28em] text-cyan-300/95 mb-1.5 font-semibold leading-tight">
                    Good {titleplateGreeting},
                  </p>
                  <h1 className="techboard-titleplate-orbitron techboard-titleplate-title-glow text-[1.0625rem] sm:text-xl md:text-2xl font-black uppercase tracking-[0.06em] sm:tracking-[0.1em] md:tracking-[0.14em] leading-none text-white">
                    {titleplateFirstName}
                  </h1>
                  <div className="mt-2 md:mt-2.5 flex flex-wrap items-center gap-2">
                    <div className="h-px w-10 md:w-16 shrink-0 bg-gradient-to-r from-cyan-300 to-transparent" />
                    <span
                      className="techboard-titleplate-orbitron text-white/45 text-[9px] md:text-[10px] tracking-[0.12em] md:tracking-[0.2em] uppercase min-h-[1em]"
                      suppressHydrationWarning
                    >
                      {titleplateDateLabel}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 pt-0.5">
                  <RouteButton />
                </div>
              </div>
            </div>
          </div>

          {/* ── NEXT JOB CARD ── */}
          {nextJob ? (
            <NextJobCard job={nextJob} />
          ) : (
            <div className="rounded-lg p-4 mb-4 text-center" style={{ background: 'rgba(13, 21, 37, 0.25)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(34,211,238,0.2)' }} data-techboard-card>
              <p className="text-sm text-gray-400">No upcoming jobs today</p>
            </div>
          )}

          {/* ── STAT CARDS ── */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard
              label="Jobs Completed"
              value={workOrderStats.completed_today}
              sub={`${todayAppts.length} scheduled today`}
              borderColor="rgba(34,211,238,0.25)"
              href="/techdashboard/opsboard"
              icon={
                <svg viewBox="0 0 24 24" className="w-6 h-6" style={{ stroke: '#22D3EE', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: 'drop-shadow(0 0 4px rgba(0,212,255,0.7))' }}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              }
            />
            <StatCard
              label="Work Orders"
              value={workOrderStats.total}
              sub={`+${workOrderStats.today} today`}
              borderColor="rgba(255,122,0,0.25)"
              sweepColor="orange"
              href="/work_orders/test"
              icon={
                <svg viewBox="0 0 24 24" className="w-6 h-6" style={{ stroke: '#FF7A00', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: 'drop-shadow(0 0 4px rgba(255,122,0,0.7))' }}>
                  <rect x="5" y="4" width="14" height="17" rx="2"/><rect x="8" y="2.5" width="8" height="4" rx="1.5"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="16" x2="13" y2="16"/>
                </svg>
              }
            />
            <StatCard
              label="Parts Waiting"
              value={workOrderStats.partsWaiting}
              sub={workOrderStats.partsWaiting > 0 ? 'orders on hold' : 'all parts in'}
              subColor={workOrderStats.partsWaiting > 0 ? '#FF7A00' : '#22D3EE'}
              borderColor={workOrderStats.partsWaiting > 0 ? 'rgba(255,122,0,0.4)' : 'rgba(34,211,238,0.2)'}
              sweepColor={workOrderStats.partsWaiting > 0 ? 'orange' : 'cyan'}
              href="/work_orders/partswait"
              icon={
                <svg viewBox="0 0 24 24" className="w-6 h-6" style={{ stroke: workOrderStats.partsWaiting > 0 ? '#FF7A00' : '#22D3EE', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: workOrderStats.partsWaiting > 0 ? 'drop-shadow(0 0 4px rgba(255,122,0,0.7))' : 'drop-shadow(0 0 4px rgba(0,212,255,0.5))' }}>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              }
            />
            <StatCard
              label="OPS Board"
              value={todayAppts.length}
              sub={nextJob?.scheduled_start ? `next at ${toEST(nextJob.scheduled_start)}` : 'none remaining'}
              borderColor="rgba(34,211,238,0.25)"
              href="/schedule-test"
              icon={
                <svg viewBox="0 0 24 24" className="w-6 h-6" style={{ stroke: '#22D3EE', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: 'drop-shadow(0 0 4px rgba(0,212,255,0.7))' }}>
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              }
            />
          </div>

          {/* ── CRITICAL MASS ── */}
          <CriticalMassCard count={workOrderStats.criticalMass} />

          {/* ── TODAY'S JOBS ── */}
          <div className="rounded-lg p-4 mb-4" style={{ background: 'rgba(13, 21, 37, 0.25)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)' }} data-techboard-card>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-base font-bold text-white">Mission Queue</h2>
              <Link href="/opsboard" className="text-xs text-cyan-400 flex items-center gap-1">
                View all
                <svg viewBox="0 0 24 24" className="w-3 h-3" style={{ stroke: 'currentColor', strokeWidth: 2.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            </div>
            {todayAppts.length === 0 ? (
              <div className="py-6 text-center">
                <svg viewBox="0 0 24 24" className="w-10 h-10 mx-auto mb-2" style={{ stroke: '#374151', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <p className="text-sm text-gray-500">No jobs scheduled today</p>
              </div>
            ) : (
              todayAppts.map((a, i) => <TodayJobRow key={a.id || i} appt={a} />)
            )}
          </div>

          {/* ── UPCOMING APPOINTMENTS ── */}
          <div className="rounded-lg p-4 mb-4" style={{ background: 'rgba(13, 21, 37, 0.25)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)' }} data-techboard-card>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-base font-bold text-white">Upcoming Appointments</h2>
              <Link href="/schedule-test" className="text-xs text-cyan-400 flex items-center gap-1">
                View all
                <svg viewBox="0 0 24 24" className="w-3 h-3" style={{ stroke: 'currentColor', strokeWidth: 2.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            </div>
            {upcomingAppts.length === 0 ? (
              <div className="py-6 text-center">
                <svg viewBox="0 0 24 24" className="w-10 h-10 mx-auto mb-2" style={{ stroke: '#374151', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <p className="text-sm text-gray-500">No upcoming appointments</p>
              </div>
            ) : (
              upcomingAppts.slice(0, 3).map((a, i) => <TodayJobRow key={a.id || i} appt={a} />)
            )}
          </div>
        </div>
      </div>

        {/* ── BOTTOM ACTION BUTTONS ── */}
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-4 pt-3 max-w-lg mx-auto" style={{ background: '#0A0F1E', borderTop: '1px solid rgba(255,255,255,0.07)', zIndex: 40 }}>
          <div className="grid grid-cols-3 gap-2">
            {/* New Work Order */}
            <Link href="/work_orders/new" className="relative flex flex-col items-center justify-center gap-1 py-3 rounded-lg text-xs font-medium text-white overflow-hidden active:scale-95 transition-transform" style={{ background: 'rgba(13, 21, 37, 0.25)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(34,211,238,0.5)', boxShadow: '0 0 10px rgba(0,212,255,0.15)' }}>
              <div className="absolute inset-0 rounded-lg" style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(0,212,255,0.12) 0%, transparent 55%), radial-gradient(ellipse at 100% 0%, rgba(0,212,255,0.12) 0%, transparent 55%), radial-gradient(ellipse at 0% 100%, rgba(0,212,255,0.12) 0%, transparent 55%), radial-gradient(ellipse at 100% 100%, rgba(0,212,255,0.12) 0%, transparent 55%)' }} />
              <svg viewBox="0 0 24 24" className="relative z-10 w-5 h-5" style={{ stroke: '#00D4FF', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: 'drop-shadow(0 0 5px rgba(0,212,255,0.9))' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span className="relative z-10" style={{ textShadow: '0 0 8px rgba(0,212,255,0.6)' }}>New WO</span>
            </Link>

            {/* Scan Model/Serial */}
            <button className="relative flex flex-col items-center justify-center gap-1 py-3 rounded-lg text-xs font-medium text-white overflow-hidden active:scale-95 transition-transform" style={{ background: 'rgba(13, 21, 37, 0.25)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,122,0,0.5)', boxShadow: '0 0 10px rgba(255,122,0,0.15)' }}>
              <div className="absolute inset-0 rounded-lg" style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(255,122,0,0.12) 0%, transparent 55%), radial-gradient(ellipse at 100% 0%, rgba(255,122,0,0.12) 0%, transparent 55%), radial-gradient(ellipse at 0% 100%, rgba(255,122,0,0.12) 0%, transparent 55%), radial-gradient(ellipse at 100% 100%, rgba(255,122,0,0.12) 0%, transparent 55%)' }} />
              <svg viewBox="0 0 24 24" className="relative z-10 w-5 h-5" style={{ stroke: '#FF7A00', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: 'drop-shadow(0 0 5px rgba(255,122,0,0.9))' }}>
                <path d="M3 9V6a1 1 0 0 1 1-1h3M3 15v3a1 1 0 0 0 1 1h3M21 9V6a1 1 0 0 0-1-1h-3M21 15v3a1 1 0 0 1-1 1h-3"/>
                <line x1="7" y1="12" x2="7" y2="12"/><line x1="10" y1="8" x2="10" y2="16"/><line x1="13" y1="10" x2="13" y2="14"/><line x1="16" y1="12" x2="16" y2="12"/>
              </svg>
              <span className="relative z-10" style={{ textShadow: '0 0 8px rgba(255,122,0,0.6)' }}>Scan</span>
            </button>

            {/* Call Next Client */}
            {nextJob?.client_phone ? (
              <a href={`tel:${nextJob.client_phone}`} className="relative flex flex-col items-center justify-center gap-1 py-3 rounded-lg text-xs font-medium text-white overflow-hidden active:scale-95 transition-transform" style={{ background: 'rgba(13, 21, 37, 0.25)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(34,211,238,0.5)', boxShadow: '0 0 10px rgba(0,212,255,0.15)' }}>
                <div className="absolute inset-0 rounded-lg" style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(0,212,255,0.12) 0%, transparent 55%), radial-gradient(ellipse at 100% 0%, rgba(0,212,255,0.12) 0%, transparent 55%), radial-gradient(ellipse at 0% 100%, rgba(0,212,255,0.12) 0%, transparent 55%), radial-gradient(ellipse at 100% 100%, rgba(0,212,255,0.12) 0%, transparent 55%)' }} />
                <svg viewBox="0 0 24 24" className="relative z-10 w-5 h-5" style={{ stroke: '#00D4FF', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: 'drop-shadow(0 0 5px rgba(0,212,255,0.9))' }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                <span className="relative z-10" style={{ textShadow: '0 0 8px rgba(0,212,255,0.6)' }}>Call Next</span>
              </a>
            ) : (
              <button disabled className="flex flex-col items-center justify-center gap-1 py-3 rounded-lg text-xs font-medium text-gray-600" style={{ background: 'rgba(13, 21, 37, 0.25)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <svg viewBox="0 0 24 24" className="w-5 h-5" style={{ stroke: '#4B5563', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                Call Next
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function getGreeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

TechDashboardTest.getLayout = (page) => <TechDashboardLayout>{page}</TechDashboardLayout>;

export async function getServerSideProps() {
  return { props: {} };
}