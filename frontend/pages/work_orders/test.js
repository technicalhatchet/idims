import { useState, useCallback, useLayoutEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { format } from 'date-fns';
import StatusBadge from '../../components/ui/StatusBadge';
/* Old nav / layout — keep for quick reactivation:
import DashboardLayout from '../../components/layouts/DashboardLayout';
*/
import TechDashboardLayout from '../../components/layouts/TechDashboardLayout';
import { useHudGridDoubleTapRail } from '../../hooks/useHudGridDoubleTapRail';
import ApplianceIcon from '../../components/ui/ApplianceIcon';
import { useWorkOrders } from '../../hooks/useWorkOrders';

/** Fractal noise overlay (matches techboard tactical shell) */
const TACTICAL_NOISE_BG =
  'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")';

const WO_TEST_PAGE_BG = '#0A0F1E';

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

function Card({ wo }) {
  const clientName = wo.client?.company_name || wo.client_name || `${wo.client?.first_name || ''} ${wo.client?.last_name || ''}`.trim() || 'No client';
  const schedDate = wo.scheduled_start ? format(new Date(wo.scheduled_start.endsWith('Z') ? wo.scheduled_start : wo.scheduled_start + 'Z'), 'MMM d, yyyy h:mm a') : 'Not scheduled';
  const equipLabel = [wo.equipment_make, wo.equipment_model].filter(Boolean).join(' ') || (wo.equipment_type || '').replace(/_/g, ' ') || 'Unknown appliance';

  return (
    <Link href={`/work_orders/${wo.id}`} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#0D1525] border border-white/10 hover:border-cyan-500/30 transition-all">
      <div className="flex-shrink-0 w-16 h-16 rounded-lg flex items-center justify-center" style={{ background: '#000000', border: '1px solid rgba(255,255,255,0.1)' }}>
        <ApplianceIcon equipmentType={wo.equipment_type} equipmentSubtype={wo.equipment_subtype} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-0.5">
          <span className="text-sm font-bold text-cyan-400">{wo.order_number}</span>
          <StatusBadge status={wo.status} />
        </div>
        <p className="text-sm font-medium text-white truncate">{clientName}</p>
        <p className="text-xs text-gray-400 truncate">{equipLabel}</p>
        <p className="text-xs text-gray-500 mt-0.5">{schedDate}</p>
        {wo.description && <p className="text-xs text-gray-500 truncate mt-0.5">{wo.description}</p>}
      </div>
      <div className="flex-shrink-0 text-gray-600 text-xl">›</div>
    </Link>
  );
}

export default function WorkOrdersTest() {
  const { data, isLoading, error } = useWorkOrders({ page: 1, limit: 100 });
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const PER_PAGE = 5;

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

  const sorted = [...(data?.items || [])].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    if (sortBy === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    if (sortBy === 'status') return (a.status || '').localeCompare(b.status || '');
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const paginated = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const count = data?.total || sorted.length;

  const handleSort = (val) => {
    setSortBy(val);
    setPage(1);
  };

  return (
    <>
      <Head>
        <title>Master OPS List | IDIMS</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <style>{`
          @keyframes wo-test-tactical-scan {
            0% { left: -48%; }
            100% { left: 115%; }
          }
          /* Ops titleplate — orange chroma; grid step matches field (42px) + alignment vars */
          .wo-test-hud-titleplate-grid {
            background-image:
              linear-gradient(rgba(255,122,0,.07) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,122,0,.07) 1px, transparent 1px);
            background-size: ${HUD_GRID_STEP}px ${HUD_GRID_STEP}px;
            background-position: var(--wo-test-hud-grid-x, 0px) var(--wo-test-hud-grid-y, 0px);
          }
          .sched-hud-orbitron {
            font-family: 'Orbitron', system-ui, sans-serif;
          }
          .sched-hud-orbitron-glow {
            text-shadow:
              0 0 8px rgba(255,255,255,.15),
              0 0 18px rgba(255,122,0,.14),
              0 0 40px rgba(251,146,60,.1);
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
              rgba(251,146,60,.55),
              rgba(180,83,9,.22),
              rgba(255,122,0,.42)
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
          /* Omit z-index; TechDashboard icon rail/header use z-index above Leaflet (~1000) */
          header, nav, .header-bar, [class*='h-16'] {
            background-color: #0D1525 !important;
            border-bottom: 1px solid rgba(255,255,255,0.07) !important;
          }
        `}</style>
      </Head>
      <div className="min-h-screen" style={{ background: WO_TEST_PAGE_BG }}>
      <div ref={tacticalColumnRef} className="hud-tactical-column relative px-4 pt-0 pb-5 max-w-lg mx-auto">
        {/* Tactical background — same layers as techboard; no extra “card” container */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute inset-0" style={{ background: WO_TEST_PAGE_BG }} />
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
                animation: 'wo-test-tactical-scan 6.5s linear infinite',
              }}
            />
          </div>
          <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] pointer-events-none" />
        </div>

        <div ref={gridTapLayerRef} className="absolute inset-0 z-[1]" aria-hidden />

        <div className="hud-grid-content relative z-10 p-4 sm:p-6">
        {/* Page header — same titleplate pattern as schedule-test “Ops Board” */}
        <div className="relative mb-4">
          <div
            ref={titleplateRef}
            data-hud-card
            className="relative overflow-hidden rounded-[18px] md:rounded-[22px] border border-orange-400/35 bg-[rgba(5,12,22,.84)] backdrop-blur-2xl px-3.5 py-3 md:px-5 md:py-4 shadow-[0_0_30px_rgba(255,122,0,.32)] sched-neon-edge sched-hud-scan"
            style={{
              ['--wo-test-hud-grid-x']: `${hudGridShift.x}px`,
              ['--wo-test-hud-grid-y']: `${hudGridShift.y}px`,
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-50 wo-test-hud-titleplate-grid"
              aria-hidden
            />
            <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-orange-600/0 opacity-60 pointer-events-none rounded-[inherit]" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none z-[1]" />
            <div className="absolute bottom-0 left-4 right-4 md:left-8 md:right-8 h-px bg-gradient-to-r from-transparent via-orange-400/25 to-transparent pointer-events-none z-[1]" />

            <div className="relative z-[2] min-w-0">
              <p className="sched-hud-orbitron text-[8px] md:text-[9px] uppercase tracking-[0.22em] md:tracking-[0.32em] text-orange-300 mb-1.5 font-semibold leading-tight">
                Mobile Initialization
              </p>
              <h1 className="sched-hud-orbitron sched-hud-orbitron-glow text-[1.0625rem] sm:text-xl md:text-2xl font-black uppercase tracking-[0.06em] sm:tracking-[0.1em] md:tracking-[0.14em] leading-none text-white">
                Master OPS List
              </h1>
              <div className="mt-2 md:mt-2.5 flex flex-wrap items-center gap-2">
                <div className="h-px w-10 md:w-16 shrink-0 bg-gradient-to-r from-orange-300 to-transparent" />
                <span className="sched-hud-orbitron text-white/40 text-[9px] md:text-[10px] tracking-[0.14em] md:tracking-[0.22em] uppercase">
                  Online
                </span>
              </div>
            </div>
          </div>
        </div>
        <Link href="/work_orders" className="inline-flex items-center gap-1 mb-4 text-xs text-gray-500 hover:text-gray-300">
          ← Real page
        </Link>

        {/* New Work Order button */}
        <Link href="/work_orders/new" className="relative block w-full py-3 mb-3 rounded-lg font-medium text-white text-center bg-[#0D1525] border border-cyan-400/60 shadow-[0_0_8px_rgba(0,212,255,0.3)] transition-all duration-300 active:scale-[0.97] hover:shadow-[0_0_12px_rgba(0,212,255,0.45)] overflow-hidden">
          <div className="absolute inset-0 rounded-lg" style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(0,212,255,0.18) 0%, transparent 50%), radial-gradient(ellipse at 100% 0%, rgba(0,212,255,0.18) 0%, transparent 50%), radial-gradient(ellipse at 0% 100%, rgba(0,212,255,0.18) 0%, transparent 50%), radial-gradient(ellipse at 100% 100%, rgba(0,212,255,0.18) 0%, transparent 50%), radial-gradient(ellipse at 50% 0%, rgba(0,212,255,0.08) 0%, transparent 55%), radial-gradient(ellipse at 50% 100%, rgba(0,212,255,0.08) 0%, transparent 55%)' }} />
          <span className="relative z-10 flex items-center justify-center gap-2" style={{ textShadow: '0 0 8px rgba(0,212,255,0.6), 0 0 20px rgba(0,212,255,0.3)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" style={{ stroke: '#00D4FF', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: 'drop-shadow(0 0 6px rgba(0,212,255,0.9)) drop-shadow(0 0 12px rgba(0,212,255,0.5))' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Work Order
          </span>
        </Link>

        {/* Filter button — same glow system as New Work Order, orange chroma */}
        <button
          type="button"
          className="relative w-full py-2.5 mb-4 rounded-lg flex items-center justify-center gap-2 text-sm font-medium text-white bg-[#0D1525] border border-orange-400/60 shadow-[0_0_8px_rgba(255,122,0,0.3)] transition-all duration-300 active:scale-[0.97] hover:shadow-[0_0_12px_rgba(255,122,0,0.45)] overflow-hidden"
        >
          <div
            className="absolute inset-0 rounded-lg"
            style={{
              background:
                'radial-gradient(ellipse at 0% 0%, rgba(255,122,0,0.18) 0%, transparent 50%), radial-gradient(ellipse at 100% 0%, rgba(255,122,0,0.18) 0%, transparent 50%), radial-gradient(ellipse at 0% 100%, rgba(255,122,0,0.18) 0%, transparent 50%), radial-gradient(ellipse at 100% 100%, rgba(255,122,0,0.18) 0%, transparent 50%), radial-gradient(ellipse at 50% 0%, rgba(255,122,0,0.08) 0%, transparent 55%), radial-gradient(ellipse at 50% 100%, rgba(255,122,0,0.08) 0%, transparent 55%)',
            }}
          />
          <svg
            viewBox="0 0 24 24"
            className="relative z-10 w-4 h-4"
            style={{
              stroke: '#fdba74',
              strokeWidth: 1.75,
              fill: 'none',
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              filter: 'drop-shadow(0 0 6px rgba(255,122,0,0.9)) drop-shadow(0 0 12px rgba(255,122,0,0.5))',
            }}
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          <span
            className="relative z-10"
            style={{
              textShadow: '0 0 8px rgba(255,122,0,0.6), 0 0 20px rgba(255,122,0,0.3)',
            }}
          >
            Filters
          </span>
        </button>

        {/* Cards container */}
        <div className="rounded-lg p-3" style={{ background: '#080C14', border: '1px solid rgba(255,255,255,0.07)' }} data-hud-card>
          {/* Container header */}
          <div className="flex justify-between items-center mb-3 px-1">
            <span className="text-sm font-medium text-gray-300">{count} Work Orders</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Sort:</span>
              <select
                value={sortBy}
                onChange={e => handleSort(e.target.value)}
                className="text-xs font-medium text-cyan-400 bg-transparent border-none outline-none cursor-pointer"
              >
                <option value="newest" className="bg-gray-900 text-white">Date (Newest)</option>
                <option value="oldest" className="bg-gray-900 text-white">Date (Oldest)</option>
                <option value="status" className="bg-gray-900 text-white">Status</option>
              </select>
              <svg viewBox="0 0 24 24" className="w-3 h-3" style={{ stroke: '#22D3EE', strokeWidth: 2.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>

          {isLoading && <p className="text-gray-400 text-sm px-1">Loading...</p>}
          {error && <p className="text-red-400 text-sm px-1">Error loading</p>}

          {!isLoading && !error && sorted.length === 0 && (
            <p className="text-gray-500 text-sm px-1 py-4 text-center">No work orders yet.</p>
          )}

          <div className="space-y-2">
            {paginated.map(wo => <Card key={wo.id} wo={wo} />)}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-white/5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 disabled:opacity-30 transition-all"
                style={{ background: '#0A0F1E' }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ stroke: 'currentColor', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className="w-8 h-8 rounded-lg text-xs font-medium transition-all"
                  style={{ background: page === n ? '#0D1525' : '#0A0F1E',
                    color: page === n ? '#22D3EE' : '#6B7280',
                    border: page === n ? '1px solid rgba(34,211,238,0.5)' : '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  {n}
                </button>
              ))}

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 disabled:opacity-30 transition-all"
                style={{ background: '#0A0F1E' }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ stroke: 'currentColor', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          )}
        </div>
        </div>

      </div>
      </div>
    </>
  );
}

WorkOrdersTest.getLayout = (page) => <TechDashboardLayout>{page}</TechDashboardLayout>;

/* Previously: standard dashboard nav + sidebar
WorkOrdersTest.getLayout = (page) => <DashboardLayout>{page}</DashboardLayout>;
*/