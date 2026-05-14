import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';
import { format } from 'date-fns';
import StatusBadge from '../../components/ui/StatusBadge';
import TechDashboardLayout from '../../components/layouts/TechDashboardLayout';
import ApplianceIcon from '../../components/ui/ApplianceIcon';
import { useWorkOrders } from '../../hooks/useWorkOrders';
import { apiClient } from '../../utils/api-client';
import { getUserRole } from '../../utils/auth0-helpers';

/** Fractal noise overlay (matches techboard tactical shell) */
const TACTICAL_NOISE_BG =
  'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")';

const PAGE_BG = '#0A0F1E';
const FETCH_LIMIT = 500;
const UNASSIGNED = '__unassigned__';

/** Same work-order statuses as techboard Parts Waiting stat (+ parts lines). */
const WO_PARTS_HOLD_STATUSES = new Set(['waiting_on_parts', 'parts_on_order']);

function normalizeWorkOrderStatus(status) {
  return String(status || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

/** Matches `partsWaiting` on /techboard: WO status holds, or nested parts ordered/needed. */
function matchesPartsWaitingStatCriteria(wo) {
  const st = normalizeWorkOrderStatus(wo.status);
  if (st === 'completed') return false;
  if (WO_PARTS_HOLD_STATUSES.has(st)) return true;
  return (
    Array.isArray(wo.parts) &&
    wo.parts.some((p) => ['ordered', 'needed'].includes(p.status))
  );
}

function clientLabel(wo) {
  return (
    wo.client?.company_name ||
    wo.client_name ||
    `${wo.client?.first_name || ''} ${wo.client?.last_name || ''}`.trim() ||
    'No client'
  );
}

function techIdKey(wo) {
  if (wo.assigned_technician_id) return String(wo.assigned_technician_id);
  return UNASSIGNED;
}

function Card({ wo }) {
  const schedDate = wo.scheduled_start
    ? format(
        new Date(
          wo.scheduled_start.endsWith('Z') || /[+-]\d{2}/.test(String(wo.scheduled_start))
            ? wo.scheduled_start
            : `${wo.scheduled_start}Z`
        ),
        'MMM d, yyyy h:mm a'
      )
    : 'Not scheduled';
  const equipLabel =
    [wo.equipment_make, wo.equipment_model].filter(Boolean).join(' ') ||
    (wo.equipment_type || '').replace(/_/g, ' ') ||
    'Unknown appliance';

  return (
    <Link
      href={`/work_orders/${wo.id}`}
      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#0D1525] border border-white/10 hover:border-orange-500/35 transition-all"
    >
      <div
        className="flex-shrink-0 w-16 h-16 rounded-lg flex items-center justify-center"
        style={{ background: '#000000', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <ApplianceIcon equipmentType={wo.equipment_type} equipmentSubtype={wo.equipment_subtype} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-0.5 gap-2">
          <span className="text-sm font-bold text-orange-300/95">{wo.order_number}</span>
          <StatusBadge status={wo.status} />
        </div>
        <p className="text-sm font-medium text-white truncate">{clientLabel(wo)}</p>
        <p className="text-xs text-gray-400 truncate">{equipLabel}</p>
        <p className="text-xs text-gray-500 mt-0.5">{schedDate}</p>
        {wo.description && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{wo.description}</p>
        )}
      </div>
      <div className="flex-shrink-0 text-gray-600 text-xl">›</div>
    </Link>
  );
}

export default function PartsWaitingPage() {
  const { user, isLoading: authLoading } = useUser();
  const [technicians, setTechnicians] = useState([]);
  const [selectedTechIds, setSelectedTechIds] = useState(() => new Set());
  const [sortBy, setSortBy] = useState('alpha_asc');
  const [search, setSearch] = useState('');

  const userRole = user ? getUserRole(user) : null;
  const isTechnician = userRole === 'technician';
  const [myTechId, setMyTechId] = useState('');

  useEffect(() => {
    if (!isTechnician || !user) return;
    const load = async () => {
      try {
        const res = await apiClient('technicians');
        const techs = res?.items || [];
        const mine = techs.find(
          (t) => t.user?.email === user.email || t.user_email === user.email
        );
        if (mine) setMyTechId(String(mine.id));
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, [isTechnician, user]);

  useEffect(() => {
    if (isTechnician) return;
    const load = async () => {
      try {
        const res = await apiClient('technicians');
        setTechnicians(res?.items || []);
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, [isTechnician]);

  useEffect(() => {
    if (isTechnician || technicians.length === 0) return;
    setSelectedTechIds(new Set([...technicians.map((t) => String(t.id)), UNASSIGNED]));
  }, [isTechnician, technicians]);

  const listParams = useMemo(() => {
    const base = { page: 1, limit: FETCH_LIMIT };
    if (isTechnician && myTechId) return { ...base, technician_id: myTechId };
    return base;
  }, [isTechnician, myTechId]);

  const { data, isLoading, error } = useWorkOrders(listParams, {
    enabled: !authLoading && (!isTechnician || !!myTechId),
  });

  const partsHoldRaw = useMemo(() => {
    const items = data?.items || [];
    return items.filter((wo) => matchesPartsWaitingStatCriteria(wo));
  }, [data]);

  const filteredSorted = useMemo(() => {
    let rows = partsHoldRaw;

    if (!isTechnician && technicians.length > 0) {
      rows = rows.filter((wo) => selectedTechIds.has(techIdKey(wo)));
    }

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((wo) => {
        const blob = [
          wo.order_number,
          clientLabel(wo),
          wo.description,
          wo.equipment_type,
          wo.equipment_make,
          wo.equipment_model,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      });
    }

    const out = [...rows];
    out.sort((a, b) => {
      const ca = clientLabel(a).toLowerCase();
      const cb = clientLabel(b).toLowerCase();
      const cra = new Date(a.created_at || 0).getTime();
      const crb = new Date(b.created_at || 0).getTime();

      switch (sortBy) {
        case 'order_newest':
          return crb - cra;
        case 'order_oldest':
          return cra - crb;
        case 'alpha_asc':
          return ca.localeCompare(cb);
        case 'alpha_desc':
          return cb.localeCompare(ca);
        default:
          return ca.localeCompare(cb);
      }
    });
    return out;
  }, [
    partsHoldRaw,
    isTechnician,
    technicians.length,
    selectedTechIds,
    search,
    sortBy,
  ]);

  const toggleTech = (id) => {
    setSelectedTechIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllTechs = () => {
    setSelectedTechIds(new Set([...technicians.map((t) => String(t.id)), UNASSIGNED]));
  };

  const clearTechs = () => {
    setSelectedTechIds(new Set());
  };

  const allTechsSelected =
    technicians.length > 0 &&
    technicians.every((t) => selectedTechIds.has(String(t.id))) &&
    selectedTechIds.has(UNASSIGNED);

  return (
    <>
      <Head>
        <title>Waiting On Parts | IDIMS</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <style>{`
          @keyframes wo-partswait-tactical-scan {
            0% { left: -48%; }
            100% { left: 115%; }
          }
          .sched-tactical-grid-bg {
            background-image:
              linear-gradient(rgba(255,122,0,.07) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,122,0,.07) 1px, transparent 1px);
            background-size: 40px 40px;
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
          .mass-select {
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
            background-color: rgba(0, 0, 0, 0) !important;
            background-image: none !important;
            box-shadow: none !important;
          }
          .mass-select:hover,
          .mass-select:focus,
          .mass-select:focus-visible,
          .mass-select:active {
            background-color: rgba(0, 0, 0, 0) !important;
            background-image: none !important;
            box-shadow: none !important;
          }
          .mass-select::-ms-expand {
            display: none;
          }
          header, nav, .header-bar, [class*='h-16'] {
            background-color: #0D1525 !important;
            border-bottom: 1px solid rgba(255,255,255,0.07) !important;
          }
        `}</style>
      </Head>
      <div className="min-h-screen" style={{ background: PAGE_BG }}>
        <div className="relative px-4 py-6 max-w-lg mx-auto">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute inset-0" style={{ background: PAGE_BG }} />
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
                  background:
                    'linear-gradient(90deg, transparent 0%, transparent 32%, rgba(255,255,255,0.024) 50%, transparent 68%, transparent 100%)',
                  animation: 'wo-partswait-tactical-scan 6.5s linear infinite',
                }}
              />
            </div>
            <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] pointer-events-none" />
          </div>

          <div className="relative z-10">
            <div className="relative mb-4">
              <div
                className="relative overflow-hidden rounded-[18px] md:rounded-[22px] border border-orange-400/35 bg-[rgba(5,12,22,.84)] backdrop-blur-2xl px-3.5 py-3 md:px-5 md:py-4 shadow-[0_0_30px_rgba(255,122,0,.32)] sched-neon-edge sched-hud-scan"
              >
                <div className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-50 sched-tactical-grid-bg" aria-hidden />
                <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-orange-600/0 opacity-60 pointer-events-none rounded-[inherit]" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none z-[1]" />
                <div className="absolute bottom-0 left-4 right-4 md:left-8 md:right-8 h-px bg-gradient-to-r from-transparent via-orange-400/25 to-transparent pointer-events-none z-[1]" />

                <div className="relative z-[2] min-w-0">
                  <p className="sched-hud-orbitron text-[8px] md:text-[9px] uppercase tracking-[0.2em] md:tracking-[0.28em] text-orange-300/95 mb-1.5 font-semibold leading-tight">
                  WO holds / parts marked ordered / needed
                  </p>
                  <h1 className="sched-hud-orbitron sched-hud-orbitron-glow text-[1.0625rem] sm:text-xl md:text-2xl font-black uppercase tracking-[0.06em] sm:tracking-[0.1em] md:tracking-[0.14em] leading-none text-white">
                    Waiting On Parts
                  </h1>
                  <div className="mt-2 md:mt-2.5 flex flex-wrap items-center gap-2">
                    <div className="h-px w-10 md:w-16 shrink-0 bg-gradient-to-r from-orange-300 to-transparent" />
                    <span className="sched-hud-orbitron text-white/45 text-[9px] md:text-[10px] tracking-[0.12em] md:tracking-[0.2em] uppercase">
                      Online
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order #, client, notes…"
              className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm text-white placeholder:text-gray-500 outline-none focus:ring-1 focus:ring-orange-400/45 bg-[rgba(13,21,37,0.25)]"
              style={{ border: '1px solid rgba(255,255,255,0.12)' }}
            />

            {!isTechnician && technicians.length > 0 && (
              <div
                className="rounded-lg p-3 mb-3"
                style={{ background: '#080C14', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Technicians
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllTechs}
                      className="text-[11px] text-orange-400/90 hover:text-orange-300"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={clearTechs}
                      className="text-[11px] text-gray-500 hover:text-gray-400"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTechIds.has(UNASSIGNED)}
                      onChange={() => toggleTech(UNASSIGNED)}
                      className="rounded border-white/20 bg-[#0D1525] text-orange-500 focus:ring-orange-500/40"
                    />
                    <span>Unassigned</span>
                  </label>
                  {technicians.map((t) => {
                    const id = String(t.id);
                    const name =
                      [t.user?.first_name, t.user?.last_name].filter(Boolean).join(' ') ||
                      (t.employee_id ? `Tech (${t.employee_id})` : 'Technician');
                    return (
                      <label
                        key={id}
                        className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTechIds.has(id)}
                          onChange={() => toggleTech(id)}
                          className="rounded border-white/20 bg-[#0D1525] text-orange-500 focus:ring-orange-500/40"
                        />
                        <span className="truncate">{name}</span>
                      </label>
                    );
                  })}
                </div>
                {!allTechsSelected && selectedTechIds.size > 0 && (
                  <p className="text-[10px] text-gray-600 mt-2">
                    Showing only selected technicians{selectedTechIds.has(UNASSIGNED) ? ' (and unassigned)' : ''}.
                  </p>
                )}
              </div>
            )}

            <div className="rounded-lg p-3" style={{ background: '#080C14', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-3 px-1">
                <span className="text-sm font-medium text-gray-300">
                  {filteredSorted.length} on parts hold
                  {partsHoldRaw.length !== filteredSorted.length
                    ? ` (${partsHoldRaw.length} before filters)`
                    : ''}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end sm:justify-start">
                  <span className="text-xs font-medium text-orange-400/70">Sort:</span>
                  <div className="relative min-w-0 max-w-[min(18rem,100%)]">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="mass-select w-full max-w-[14rem] cursor-pointer rounded-lg border border-orange-400/25 py-1 pl-0 pr-8 text-xs font-medium text-orange-400/95 outline-none focus:ring-1 focus:ring-orange-400/35"
                      style={{
                        backgroundColor: 'transparent',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                      }}
                    >
                      <option value="alpha_asc" className="bg-[#111827] text-white">
                        Client A–Z
                      </option>
                      <option value="alpha_desc" className="bg-[#111827] text-white">
                        Client Z–A
                      </option>
                      <option value="order_oldest" className="bg-[#111827] text-white">
                        Order age (oldest first)
                      </option>
                      <option value="order_newest" className="bg-[#111827] text-white">
                        Order age (newest first)
                      </option>
                    </select>
                    <svg
                      viewBox="0 0 24 24"
                      className="pointer-events-none absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2"
                      style={{
                        stroke: '#fb923c',
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
              </div>

              {isTechnician && !myTechId && !authLoading && (
                <p className="text-gray-500 text-sm px-1 py-4 text-center">Linking your technician…</p>
              )}

              {isLoading && <p className="text-gray-400 text-sm px-1">Loading…</p>}
              {error && <p className="text-red-400 text-sm px-1">Could not load work orders.</p>}

              {!isLoading &&
                !error &&
                (isTechnician ? myTechId : true) &&
                filteredSorted.length === 0 && (
                  <p className="text-gray-500 text-sm px-1 py-4 text-center">
                    No orders match the Parts Waiting criteria.
                  </p>
                )}

              <div className="space-y-2">
                {filteredSorted.map((wo) => (
                  <Card key={wo.id} wo={wo} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

PartsWaitingPage.getLayout = (page) => <TechDashboardLayout>{page}</TechDashboardLayout>;
