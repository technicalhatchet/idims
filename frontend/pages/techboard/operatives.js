import { useState, useCallback, useLayoutEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { FaPlusCircle } from 'react-icons/fa';
import TechDashboardLayout from '../../components/layouts/TechDashboardLayout';
import { useHudGridDoubleTapRail } from '../../hooks/useHudGridDoubleTapRail';
import { useTechnicians } from '../../hooks/useTechnicians';

const TACTICAL_NOISE_BG =
  'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")';

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
      data-hud-card
    >
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
          style={{ background: '#080C14', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" style={{ stroke: '#22D3EE', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>

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
              <p className="text-xs text-gray-400 truncate">{technician.user.email}</p>
            )}
            {technician.user?.phone && (
              <p className="text-xs text-gray-400 truncate">{technician.user.phone}</p>
            )}
            {technician.employee_id && (
              <p className="text-xs text-gray-400 truncate">#{technician.employee_id}</p>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 text-gray-600 text-xl">›</div>
      </div>
    </Link>
  );
}

export default function OperativesPage() {
  const [page] = useState(1);
  const [status, setStatus] = useState('');

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

  const queryParams = { page, limit: 50 };
  if (status) queryParams.status = status;

  const { data, isLoading, error } = useTechnicians(queryParams);
  const technicians = data?.items || [];

  return (
    <>
      <Head>
        <title>Operatives | Field Tech Dashboard</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
        <style>{`
          @keyframes operatives-tactical-scan {
            0% { left: -48%; }
            100% { left: 115%; }
          }
          .operatives-hud-titleplate-grid {
            background-image:
              linear-gradient(rgba(0, 217, 255, 0.07) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 217, 255, 0.07) 1px, transparent 1px);
            background-size: ${HUD_GRID_STEP}px ${HUD_GRID_STEP}px;
            background-position: var(--operatives-hud-grid-x, 0px) var(--operatives-hud-grid-y, 0px);
          }
          .operatives-hud-orbitron {
            font-family: 'Orbitron', system-ui, sans-serif;
          }
          .operatives-hud-orbitron-glow {
            text-shadow:
              0 0 8px rgba(255, 255, 255, 0.15),
              0 0 18px rgba(34, 211, 238, 0.35),
              0 0 40px rgba(0, 212, 255, 0.22);
          }
          .operatives-neon-edge {
            position: relative;
          }
          .operatives-neon-edge::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            padding: 1px;
            background: linear-gradient(135deg, rgba(34, 211, 238, 0.72), rgba(8, 51, 68, 0.28), rgba(0, 212, 255, 0.5));
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            mask-composite: exclude;
            pointer-events: none;
          }
          .operatives-hud-scan::after {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.085), transparent);
            animation: operatives-hud-scan 5s linear infinite;
            border-radius: inherit;
            pointer-events: none;
          }
          @keyframes operatives-hud-scan {
            100% { left: 120%; }
          }
        `}</style>
      </Head>

      <div className="min-h-screen" style={{ background: PAGE_BG }}>
        <div
          ref={tacticalColumnRef}
          className="hud-tactical-column relative px-4 pt-0 pb-5 max-w-lg mx-auto min-h-screen"
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute inset-0" style={{ background: PAGE_BG }} />
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
              style={{ backgroundImage: TACTICAL_NOISE_BG }}
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
                  animation: 'operatives-tactical-scan 6.5s linear infinite',
                }}
              />
            </div>
            <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] pointer-events-none" />
          </div>

          <div ref={gridTapLayerRef} className="absolute inset-0 z-[1]" aria-hidden="true" />

          <div className="hud-grid-content relative z-10 px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="mb-5">
              <div
                ref={titleplateRef}
                data-hud-card
                className="relative overflow-hidden rounded-[18px] md:rounded-[22px] border border-cyan-400/35 bg-[rgba(5,12,22,.84)] backdrop-blur-2xl px-3.5 py-3 md:px-5 md:py-4 shadow-[0_0_30px_rgba(0,212,255,.28)] operatives-neon-edge operatives-hud-scan"
                style={{
                  '--operatives-hud-grid-x': `${hudGridShift.x}px`,
                  '--operatives-hud-grid-y': `${hudGridShift.y}px`,
                }}
              >
                <div className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-50 operatives-hud-titleplate-grid" aria-hidden />
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-cyan-950/0 opacity-60 pointer-events-none rounded-[inherit]" />
                <div className="relative z-[2] min-w-0">
                  <p className="operatives-hud-orbitron text-[8px] md:text-[9px] uppercase tracking-[0.2em] text-cyan-300/95 mb-1.5 font-semibold">
                    Field Personnel
                  </p>
                  <h1 className="operatives-hud-orbitron operatives-hud-orbitron-glow text-[1.0625rem] sm:text-xl md:text-2xl font-black uppercase tracking-[0.06em] text-white">
                    Operatives
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="h-px w-10 shrink-0 bg-gradient-to-r from-cyan-300 to-transparent" />
                    <span className="operatives-hud-orbitron text-white/45 text-[9px] tracking-[0.12em] uppercase">
                      {technicians.length} operative{technicians.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mb-3 overflow-x-auto pb-1" data-hud-card>
              {['', 'active', 'inactive', 'on_leave'].map((statusOption) => (
                <button
                  key={statusOption || 'all'}
                  type="button"
                  onClick={() => setStatus(statusOption)}
                  className="px-4 py-2 text-xs uppercase tracking-wide font-medium rounded-lg whitespace-nowrap transition-all"
                  style={{
                    background: status === statusOption ? 'rgba(34, 211, 238, 0.25)' : 'rgba(13, 21, 37, 0.4)',
                    border: `1px solid ${status === statusOption ? 'rgba(34, 211, 238, 0.5)' : 'rgba(255,255,255,0.1)'}`,
                    color: status === statusOption ? '#22D3EE' : '#9CA3AF',
                  }}
                >
                  {statusOption || 'All'}
                </button>
              ))}
            </div>

            <Link
              href="/technicians/txmobile_new"
              className="flex items-center justify-center gap-2 w-full mb-4 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wide transition-all active:opacity-90"
              style={{
                background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.25), rgba(147, 51, 234, 0.25))',
                border: '1px solid rgba(34, 211, 238, 0.6)',
                color: '#22D3EE',
                boxShadow: '0 0 30px rgba(34, 211, 238, 0.4)',
              }}
              data-hud-card
            >
              <FaPlusCircle className="text-lg" />
              New Operative
            </Link>

            <div className="space-y-2">
              {isLoading && (
                <p className="text-gray-400 text-sm text-center py-8" data-hud-card>Loading...</p>
              )}
              {error && (
                <p className="text-red-400 text-sm text-center py-8" data-hud-card>Failed to load technicians</p>
              )}
              {!isLoading && !error && technicians.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-8" data-hud-card>No technicians found</p>
              )}
              {!isLoading && !error && technicians.map((technician) => (
                <TechnicianCard key={technician.id} technician={technician} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

OperativesPage.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};
