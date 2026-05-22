import { useState, useEffect, useCallback, useLayoutEffect, useRef, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';
import TechDashboardLayout from '../../components/layouts/TechDashboardLayout';
import { useHudGridDoubleTapRail } from '../../hooks/useHudGridDoubleTapRail';
import { useClients } from '../../services/api/clientsApi';

/** Fractal noise overlay */
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

function ClientCard({ client }) {
  const displayName = client.company_name || `${client.first_name} ${client.last_name}`;
  const isCompany = Boolean(client.company_name);
  const contactName = isCompany ? `${client.first_name} ${client.last_name}` : null;

  return (
    <Link
      href={`/clients/${client.id}/mobile`}
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
          {isCompany ? (
            <svg viewBox="0 0 24 24" className="w-6 h-6" style={{ stroke: '#22D3EE', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <line x1="9" y1="7" x2="15" y2="7" />
              <line x1="9" y1="11" x2="15" y2="11" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-6 h-6" style={{ stroke: '#22D3EE', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1">
            <p className="text-base font-bold text-white truncate">{displayName}</p>
            <span
              className="ml-2 px-2 py-0.5 text-[10px] uppercase tracking-wide font-medium rounded-full flex-shrink-0"
              style={{
                background: client.status === 'active'
                  ? 'rgba(34, 211, 238, 0.15)'
                  : client.status === 'inactive'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(251, 146, 60, 0.15)',
                color: client.status === 'active'
                  ? '#22D3EE'
                  : client.status === 'inactive'
                  ? '#EF4444'
                  : '#FB923C',
              }}
            >
              {client.status || 'Unknown'}
            </span>
          </div>

          {contactName && (
            <p className="text-sm text-gray-400 mb-1">{contactName}</p>
          )}

          <div className="space-y-0.5">
            {client.email && (
              <div className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" style={{ stroke: '#9CA3AF', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <p className="text-xs text-gray-400 truncate">{client.email}</p>
              </div>
            )}

            {(client.phone || client.mobile) && (
              <div className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" style={{ stroke: '#9CA3AF', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4A2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <p className="text-xs text-gray-400 truncate">{client.phone || client.mobile}</p>
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

export default function AssetsPage() {
  const { user } = useUser();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
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

  const { data, isLoading, error, refetch } = useClients({
    page,
    limit: 100,
    search,
    status,
  });

  const filteredClients = useMemo(() => {
    return data?.items || [];
  }, [data]);

  return (
    <>
      <Head>
        <title>Client Assets | IDIMS</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <style>{`
          @keyframes assets-tactical-scan {
            0% { left: -48%; }
            100% { left: 115%; }
          }
          .assets-hud-titleplate-grid {
            background-image:
              linear-gradient(rgba(0, 217, 255, 0.07) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 217, 255, 0.07) 1px, transparent 1px);
            background-size: ${HUD_GRID_STEP}px ${HUD_GRID_STEP}px;
            background-position: var(--assets-hud-grid-x, 0px) var(--assets-hud-grid-y, 0px);
          }
          .assets-hud-orbitron {
            font-family: 'Orbitron', system-ui, sans-serif;
          }
          .assets-hud-orbitron-glow {
            text-shadow:
              0 0 8px rgba(255, 255, 255, 0.15),
              0 0 18px rgba(34, 211, 238, 0.35),
              0 0 40px rgba(0, 212, 255, 0.22);
          }
          .assets-neon-edge {
            position: relative;
          }
          .assets-neon-edge::before {
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
          .assets-hud-scan::after {
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
            animation: assets-hud-scan 5s linear infinite;
            border-radius: inherit;
            pointer-events: none;
          }
          @keyframes assets-hud-scan {
            100% { left: 120%; }
          }
        `}</style>
      </Head>

      <div className="min-h-screen" style={{ background: PAGE_BG }}>
        <div
          ref={tacticalColumnRef}
          className="hud-tactical-column relative px-4 pt-0 pb-5 max-w-lg mx-auto min-h-screen"
        >
          {/* Tactical background */}
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
                  background:
                    'linear-gradient(90deg, transparent 0%, transparent 32%, rgba(255,255,255,0.024) 50%, transparent 68%, transparent 100%)',
                  animation: 'assets-tactical-scan 6.5s linear infinite',
                }}
              />
            </div>
            <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] pointer-events-none" />
          </div>

          <div ref={gridTapLayerRef} className="absolute inset-0 z-[1]" aria-hidden />

          <div className="hud-grid-content relative z-10 p-4 sm:p-6">
            {/* HUD Titleplate */}
            <div className="mb-5">
              <div
                ref={titleplateRef}
                data-hud-card
                className="relative overflow-hidden rounded-[18px] md:rounded-[22px] border border-cyan-400/35 bg-[rgba(5,12,22,.84)] backdrop-blur-2xl px-3.5 py-3 md:px-5 md:py-4 shadow-[0_0_30px_rgba(0,212,255,.28)] assets-neon-edge assets-hud-scan"
                style={{
                  ['--assets-hud-grid-x']: `${hudGridShift.x}px`,
                  ['--assets-hud-grid-y']: `${hudGridShift.y}px`,
                }}
              >
                <div
                  className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-50 assets-hud-titleplate-grid"
                  aria-hidden
                />
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-cyan-950/0 opacity-60 pointer-events-none rounded-[inherit]" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none z-[1]" />
                <div className="absolute bottom-0 left-4 right-4 md:left-8 md:right-8 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent pointer-events-none z-[1]" />

                <div className="relative z-[2] min-w-0">
                  <p className="assets-hud-orbitron text-[8px] md:text-[9px] uppercase tracking-[0.2em] md:tracking-[0.28em] text-cyan-300/95 mb-1.5 font-semibold leading-tight">
                    Client Database
                  </p>
                  <h1 className="assets-hud-orbitron assets-hud-orbitron-glow text-[1.0625rem] sm:text-xl md:text-2xl font-black uppercase tracking-[0.06em] sm:tracking-[0.1em] md:tracking-[0.14em] leading-none text-white">
                    Assets
                  </h1>
                  <div className="mt-2 md:mt-2.5 flex flex-wrap items-center gap-2">
                    <div className="h-px w-10 md:w-16 shrink-0 bg-gradient-to-r from-cyan-300 to-transparent" />
                    <span className="assets-hud-orbitron text-white/45 text-[9px] md:text-[10px] tracking-[0.12em] md:tracking-[0.2em] uppercase">
                      {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Search */}
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm text-white placeholder:text-gray-500 outline-none focus:ring-1 focus:ring-cyan-400/45 bg-[rgba(13,21,37,0.25)]"
              style={{ border: '1px solid rgba(255,255,255,0.12)' }}
              data-hud-card
            />

            {/* Status Filter */}
            <div className="mb-3">
              <div className="relative" data-hud-card>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full cursor-pointer rounded-lg border border-cyan-400/25 py-2 pl-3 pr-8 text-sm font-medium text-cyan-400/95 outline-none focus:ring-1 focus:ring-cyan-400/35 bg-transparent"
                  style={{
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    appearance: 'none',
                  }}
                >
                  <option value="" className="bg-[#111827] text-white">
                    All Clients
                  </option>
                  <option value="active" className="bg-[#111827] text-white">
                    Active
                  </option>
                  <option value="inactive" className="bg-[#111827] text-white">
                    Inactive
                  </option>
                  <option value="lead" className="bg-[#111827] text-white">
                    Lead
                  </option>
                </select>
                <svg
                  viewBox="0 0 24 24"
                  className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2"
                  style={{
                    stroke: '#22D3EE',
                    strokeWidth: 2.5,
                    fill: 'none',
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                  }}
                  aria-hidden
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {/* New Client Button */}
            <Link
              href="/clients/mobile_new"
              className="w-full flex items-center justify-center gap-2 py-3 mb-3 rounded-lg text-sm font-bold uppercase tracking-wide transition-all active:opacity-70"
              style={{
                background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.25), rgba(34, 211, 238, 0.15))',
                border: '1px solid rgba(34, 211, 238, 0.4)',
                color: '#22D3EE',
                boxShadow: '0 0 15px rgba(34, 211, 238, 0.2)',
              }}
              data-hud-card
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              New Client
            </Link>

            {/* Client List */}
            <div
              className="rounded-lg p-3"
              style={{ background: '#080C14', border: '1px solid rgba(255,255,255,0.07)' }}
              data-hud-card
            >
              {isLoading ? (
                <p className="text-gray-400 text-sm text-center py-8">Loading clients...</p>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-red-400 text-sm mb-2">Failed to load clients</p>
                  <button
                    onClick={() => refetch()}
                    className="text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    Try again
                  </button>
                </div>
              ) : filteredClients.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">
                  No clients found. Try adjusting your search.
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredClients.map((client) => (
                    <ClientCard key={client.id} client={client} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

AssetsPage.getLayout = (page) => <TechDashboardLayout>{page}</TechDashboardLayout>;
