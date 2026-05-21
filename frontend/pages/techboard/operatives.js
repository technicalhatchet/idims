import { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { FaPlusCircle } from 'react-icons/fa';
import { useUser } from '@auth0/nextjs-auth0/client';
import TechDashboardLayout from '../../components/layouts/TechDashboardLayout';
import { useTechDashboardRail } from '../../components/layouts/TechDashboardLayout';
import { useTechnicians } from '../../hooks/useTechnicians';

const PAGE_BG = '#0A0F1E';
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

function TechnicianCard({ technician }) {
  const displayName = technician.user 
    ? `${technician.user.first_name} ${technician.user.last_name}`
    : technician.employee_id;

  return (
    <Link
      href={`/technicians/${technician.id}/txmobile_view`}
      className="block rounded-lg p-4 transition-all active:opacity-90"
      style={{
        background: 'rgba(13, 21, 37, 0.25)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(34,211,238,0.25)',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
          style={{ background: '#080C14', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" style={{ stroke: '#22D3EE', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1">
            <p className="text-base font-bold text-white truncate">{displayName}</p>
            <span
              className="ml-2 px-2 py-0.5 text-[10px] uppercase tracking-wide font-medium rounded-full flex-shrink-0"
              style={{
                background: technician.status === 'active'
                  ? 'rgba(34, 211, 238, 0.15)'
                  : technician.status === 'inactive'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(251, 146, 60, 0.15)',
                color: technician.status === 'active'
                  ? '#22D3EE'
                  : technician.status === 'inactive'
                  ? '#EF4444'
                  : '#FB923C',
              }}
            >
              {technician.status || 'Unknown'}
            </span>
          </div>

          <div className="space-y-0.5">
            {technician.user?.email && (
              <div className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" style={{ stroke: '#9CA3AF', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <p className="text-xs text-gray-400 truncate">{technician.user.email}</p>
              </div>
            )}

            {technician.user?.phone && (
              <div className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" style={{ stroke: '#9CA3AF', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4A2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <p className="text-xs text-gray-400 truncate">{technician.user.phone}</p>
              </div>
            )}

            {technician.employee_id && (
              <div className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" style={{ stroke: '#9CA3AF', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <p className="text-xs text-gray-400 truncate">#{technician.employee_id}</p>
              </div>
            )}
          </div>
        </div>

        {/* Chevron */}
        <div className="flex-shrink-0 text-gray-600 text-xl">›</div>
      </div>
    </Link>
  );
}

export default function OperativesPage() {
  const { user } = useUser();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const tacticalColumnRef = useRef(null);
  const { openRail } = useTechDashboardRail() || {};
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

  // Attach double-tap listener
  useEffect(() => {
    if (!tacticalColumnRef.current || !openRail) return;

    const layer = tacticalColumnRef.current;
    const lastTap = { t: 0, x: 0, y: 0 };

    const tryOpenRail = (x, y, event) => {
      const now = Date.now();
      const dt = now - lastTap.t;
      const dist = Math.hypot(x - lastTap.x, y - lastTap.y);
      if (lastTap.t && dt < 350 && dist < 48) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        openRail();
        lastTap.t = 0;
        return true;
      }
      lastTap.t = now;
      lastTap.x = x;
      lastTap.y = y;
      return false;
    };

    const onTouch = (e) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        if (tryOpenRail(t.clientX, t.clientY, e)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    const onDblClick = (e) => {
      if (tryOpenRail(e.clientX, e.clientY, e)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    layer.addEventListener('touchstart', onTouch, { passive: false });
    layer.addEventListener('dblclick', onDblClick);

    return () => {
      layer.removeEventListener('touchstart', onTouch);
      layer.removeEventListener('dblclick', onDblClick);
    };
  }, [openRail]);

  const queryParams = { page, limit: 50 };
  if (status) queryParams.status = status;

  const { data, isLoading, error } = useTechnicians(queryParams);

  const technicians = data?.items || [];

  return (
    <>
      <Head>
        <title>Operatives | Field Tech Dashboard</title>
      </Head>

      <style jsx>{`
        @keyframes tactical-scan {
          0%, 100% { transform: translateY(-100%); }
          50% { transform: translateY(100%); }
        }
        .hud-tactical-scan-line {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(34, 211, 238, 0.5) 50%,
            transparent 100%
          );
          pointer-events: none;
          animation: tactical-scan 4s ease-in-out infinite;
          box-shadow: 0 0 8px rgba(34, 211, 238, 0.5);
        }
        .hud-titleplate-grid {
          background-image:
            linear-gradient(rgba(34, 211, 238, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 211, 238, 0.15) 1px, transparent 1px);
          background-size: 8px 8px;
        }
        .hud-tactical-column {
          touch-action: manipulation;
        }
      `}</style>

      <div className="min-h-screen pb-24" style={{ background: PAGE_BG }}>
        <div
          ref={tacticalColumnRef}
          className="hud-tactical-column relative px-4 pt-0 pb-5 max-w-lg mx-auto"
          style={{ minHeight: '100vh' }}
        >
          {/* Tactical background */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute inset-0" style={{ background: PAGE_BG }} />
            <div
              className="absolute inset-0 opacity-[0.11]
                bg-[linear-gradient(rgba(0,217,255,.36)_1px,transparent_1px),linear-gradient(90deg,rgba(0,217,255,.28)_1px,transparent_1px)]
                bg-[size:42px_42px]"
            />
            <div
              className="absolute inset-0 opacity-[0.025]"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")' }}
            />
            <div className="hud-tactical-scan-line" />
          </div>

          {/* Fixed HUD titleplate */}
          <div
            ref={titleplateRef}
            className="sticky top-0 z-20 -mx-4 px-4 py-3 mb-4 hud-titleplate-grid"
            style={{
              background: 'rgba(10, 15, 30, 0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderBottom: '1px solid rgba(34, 211, 238, 0.25)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            }}
          >
            <div className="flex items-center justify-between">
              <h1
                className="text-xl font-bold uppercase tracking-widest"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  color: '#22D3EE',
                  textShadow: '0 0 10px rgba(34,211,238,0.5)',
                }}
              >
                Operatives
              </h1>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {['', 'active', 'inactive', 'on_leave'].map((statusOption) => (
              <button
                key={statusOption}
                onClick={() => setStatus(statusOption)}
                className="px-4 py-2 text-xs uppercase tracking-wide font-medium rounded-lg whitespace-nowrap transition-all"
                style={{
                  background: status === statusOption
                    ? 'rgba(34, 211, 238, 0.25)'
                    : 'rgba(13, 21, 37, 0.4)',
                  border: `1px solid ${status === statusOption ? 'rgba(34, 211, 238, 0.5)' : 'rgba(255,255,255,0.1)'}`,
                  color: status === statusOption ? '#22D3EE' : '#9CA3AF',
                }}
              >
                {statusOption || 'All'}
              </button>
            ))}
          </div>

          {/* New Technician Button */}
          <Link
            href="/technicians/txmobile_new"
            className="flex items-center justify-center gap-2 w-full mb-4 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wide transition-all active:opacity-90"
            style={{
              background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.15), rgba(147, 51, 234, 0.15))',
              border: '1px solid rgba(34, 211, 238, 0.4)',
              color: '#22D3EE',
              boxShadow: '0 0 20px rgba(34, 211, 238, 0.2)',
            }}
          >
            <FaPlusCircle className="text-lg" />
            New Operative
          </Link>

          {/* Technician Cards */}
          <div className="space-y-3">
            {isLoading && (
              <div className="text-center py-8 text-gray-400">Loading...</div>
            )}

            {error && (
              <div
                className="rounded-lg p-4 text-center"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#EF4444',
                }}
              >
                Failed to load technicians
              </div>
            )}

            {!isLoading && !error && technicians.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                No technicians found
              </div>
            )}

            {!isLoading && !error && technicians.map((technician) => (
              <TechnicianCard key={technician.id} technician={technician} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

OperativesPage.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};