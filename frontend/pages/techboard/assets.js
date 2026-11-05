import { useState, useEffect, useCallback, useLayoutEffect, useRef, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';
import TechDashboardLayout from '../../components/layouts/TechDashboardLayout';
import TechMobileBackDock from '../../components/layouts/TechMobileBackDock';
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

/** Name shown on the card (and used for A–Z): company, else first + last. */
function clientDisplayName(client) {
  const company = (client?.company_name || '').trim();
  if (company) return company;
  return [client?.first_name, client?.last_name].filter(Boolean).join(' ').trim() || 'Unnamed client';
}

const STATUS_ACCENT = { active: '#22D3EE', lead: '#FB923C', inactive: '#334155' };
const STATUS_TAG = {
  lead: { text: 'Lead', bg: 'rgba(251, 146, 60, 0.15)', fg: '#FB923C' },
  inactive: { text: 'Inactive', bg: 'rgba(148, 163, 184, 0.15)', fg: '#94A3B8' },
};

const FILTER_CHIPS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'lead', label: 'Leads' },
  { value: 'inactive', label: 'Inactive' },
];

function ClientCard({ client }) {
  const displayName = clientDisplayName(client);
  const contactName = client.company_name
    ? [client.first_name, client.last_name].filter(Boolean).join(' ')
    : '';
  const phone = client.mobile || client.phone;
  const tag = STATUS_TAG[client.status];

  return (
    <Link
      href={`/clients/${client.id}/mobile`}
      className="relative block overflow-hidden rounded-xl py-3 pl-3.5 pr-9 transition-all active:opacity-90"
      style={{
        background: 'rgba(13, 21, 37, 0.55)',
        border: '1px solid rgba(34, 211, 238, 0.18)',
      }}
    >
      {/* Status accent */}
      <span
        aria-hidden
        className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r"
        style={{ background: STATUS_ACCENT[client.status] || '#475569' }}
      />

      <div className="flex min-w-0 items-center gap-2">
        <p className="truncate text-base font-bold text-white">{displayName}</p>
        {tag ? (
          <span
            className="flex-shrink-0 rounded-full px-[7px] py-[2px] text-[9px] font-extrabold uppercase tracking-[0.1em]"
            style={{ background: tag.bg, color: tag.fg }}
          >
            {tag.text}
          </span>
        ) : null}
      </div>

      {contactName ? <p className="mt-0.5 truncate text-xs text-[#8FA3B8]">{contactName}</p> : null}

      {phone || client.email ? (
        <div className="mt-1.5 flex min-w-0 gap-3.5 text-[13px] text-[#9FB0C2]">
          {phone ? <span className="flex-shrink-0 whitespace-nowrap text-[#A5F3FC]">{phone}</span> : null}
          {client.email ? <span className="min-w-0 truncate">{client.email}</span> : null}
        </div>
      ) : null}

      <span aria-hidden className="absolute right-3 top-1/2 -translate-y-1/2 text-xl text-[#3E5168]">›</span>
    </Link>
  );
}

export default function AssetsPage() {
  const { user } = useUser();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('az');
  const searchRef = useRef(null);

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
    const items = data?.items || [];
    // The server returns newest first; A–Z sorts by the name on the card.
    if (sort !== 'az') return items;
    return [...items].sort((a, b) =>
      clientDisplayName(a).localeCompare(clientDisplayName(b), undefined, { sensitivity: 'base' }));
  }, [data, sort]);

  const focusSearch = useCallback(() => {
    const el = searchRef.current;
    if (!el) return;
    // Focus inside the tap so iOS opens the keyboard, then bring the box into view.
    el.focus({ preventScroll: true });
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

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
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[min(560px,120%)] h-[220px] bg-cyan-400/[0.085] blur-[64px] rounded-full" />
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
                className="relative overflow-hidden rounded-[18px] md:rounded-[22px] border border-cyan-400/35 bg-[rgba(5,12,22,.84)]  px-3.5 py-3 md:px-5 md:py-4 shadow-[0_0_30px_rgba(0,212,255,.28)] assets-neon-edge assets-hud-scan"
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
              ref={searchRef}
              type="search"
              aria-label="Search clients"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm text-white placeholder:text-gray-500 outline-none focus:ring-1 focus:ring-cyan-400/45 bg-[rgba(13,21,37,0.25)]"
              style={{ border: '1px solid rgba(255,255,255,0.12)' }}
              data-hud-card
            />

            {/* Status chips + sort */}
            <div className="mb-3 flex items-center gap-1.5" data-hud-card>
              <div role="group" aria-label="Filter by status" className="flex min-w-0 flex-1 gap-1.5">
                {FILTER_CHIPS.map((chip) => {
                  const on = status === chip.value;
                  return (
                    <button
                      key={chip.value || 'all'}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setStatus(chip.value)}
                      className="h-[34px] whitespace-nowrap rounded-full px-[11px] text-xs font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200"
                      style={
                        on
                          ? { background: '#22D3EE', color: '#03161C', border: '1px solid #A5F3FC' }
                          : { background: 'rgba(13, 22, 38, 0.8)', color: '#A5F3FC', border: '1px solid #1F3B55' }
                      }
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setSort((v) => (v === 'az' ? 'new' : 'az'))}
                aria-label={sort === 'az' ? 'Sorted A to Z. Switch to newest first' : 'Sorted newest first. Switch to A to Z'}
                className="flex h-[34px] flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-[10px] px-2.5 font-mono text-[11px] font-bold tracking-[0.06em] text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200"
                style={{ background: 'rgba(13, 22, 38, 0.8)', border: '1px solid #1F3B55' }}
              >
                <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />
                </svg>
                {sort === 'az' ? 'A–Z' : 'NEWEST'}
              </button>
            </div>

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
                  {filteredClients.map((client, i) => {
                    const letter = clientDisplayName(client).charAt(0).toUpperCase();
                    const prev = i > 0 ? clientDisplayName(filteredClients[i - 1]).charAt(0).toUpperCase() : null;
                    const showLetter = sort === 'az' && letter !== prev;
                    return (
                      <div key={client.id}>
                        {showLetter ? (
                          <div className={`mb-1.5 flex items-center gap-2.5 px-0.5 ${i > 0 ? 'mt-3' : ''}`}>
                            <span className="assets-hud-orbitron text-[13px] font-extrabold text-cyan-400">{letter}</span>
                            <span className="h-px flex-1 bg-gradient-to-r from-cyan-400/45 to-transparent" />
                          </div>
                        ) : null}
                        <ClientCard client={client} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <TechMobileBackDock
        primary={{ label: 'New Client', icon: 'plus', href: '/clients/mobile_new' }}
        secondary={{ label: 'Search', icon: 'search', onPress: focusSearch }}
      />
    </>
  );
}

AssetsPage.getLayout = (page) => <TechDashboardLayout>{page}</TechDashboardLayout>;
