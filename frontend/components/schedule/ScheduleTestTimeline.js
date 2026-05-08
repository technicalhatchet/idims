import { useMemo, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO, differenceInMinutes, isSameDay } from 'date-fns';
import StatusBadge from '../ui/StatusBadge';

/** Business window (local clock) displayed on tactical grid */
const START_HOUR = 8;
const END_HOUR = 18;

/**
 * Vertical grid subdivisions inside each hour (e.g. 6 bands ≈ 10‑minute rhythm).
 * Must stay in sync with how we paint the minor horizontal lines — all %‑based so
 * appointment blocks remain aligned regardless of viewport height.
 */
const SUBDIVISIONS_PER_HOUR = 6;

/** Minimum px per hour on the timeline — more vertical room for WO detail */
const MIN_PX_PER_HOUR = 107;

/** Align this hour’s band to the viewport top after mount (scrolls page; hides cut-off earlier hour labels). */
const TIMELINE_SCROLL_ANCHOR_HOUR = 8;

const HUD_EASE = [0.4, 0, 0.2, 1];

/** Composited FUI-style grid: time-locked minors + hour majors only (no mixed px grids). */
function TimelineGridScene({ slotCount }) {
  const totalSteps = slotCount * SUBDIVISIONS_PER_HOUR;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]"
      aria-hidden
    >
      {/* L1 — deep base */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(165deg, #010509 0%, #050f18 42%, #020407 100%)',
        }}
      />
      {/* L2 — ambient radial pool */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 50% 18%, rgba(0,217,255,0.1), transparent 58%),
            radial-gradient(ellipse 90% 48% at 72% 55%, rgba(34,211,238,0.05), transparent 50%)
          `,
        }}
      />
      {/* L3 — vertical columns (texture only — does not affect time alignment) */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.62,
          backgroundImage: `
            repeating-linear-gradient(
              90deg,
              transparent 0,
              transparent 47px,
              rgba(0,217,255,0.055) 48px,
              rgba(0,217,255,0.055) 49px
            )
          `,
        }}
      />
      {/* L4 — minor horizontal: equal steps within each hour */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.88,
          backgroundImage: `
            repeating-linear-gradient(
              to bottom,
              transparent 0,
              transparent calc(100% / ${totalSteps} - 1px),
              rgba(0,217,255,0.055) calc(100% / ${totalSteps} - 1px),
              rgba(0,217,255,0.055) calc(100% / ${totalSteps})
            )
          `,
        }}
      />
      {/* L5 — hour majors (strong hierarchy; aligns with axis labels) */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.92,
          backgroundImage: `
            repeating-linear-gradient(
              to bottom,
              transparent 0,
              transparent calc(100% / ${slotCount} - 1px),
              rgba(0,217,255,0.145) calc(100% / ${slotCount} - 1px),
              rgba(0,217,255,0.145) calc(100% / ${slotCount})
            )
          `,
        }}
      />
      {/* L6 — vignette + rim */}
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={{
          boxShadow: `
            inset 0 1px 0 rgba(0,217,255,0.07),
            inset 0 -1px 0 rgba(0,0,0,0.55),
            inset 0 0 90px rgba(0,0,0,0.5),
            inset 0 0 28px rgba(0,0,0,0.35)
          `,
        }}
      />
    </div>
  );
}

function minsFromMidnight(d) {
  return d.getHours() * 60 + d.getMinutes();
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/** Ordered palette matches Atomic Repair neon accent system */
export const NEON_RAILS = ['#22D3EE', '#FF7A00', '#A855F7', '#22C55E'];

export function buildTechnicianRailMap(items, neonRails = NEON_RAILS) {
  const seenOrder = [];
  const map = {};
  items.forEach((item) => {
    const tid = item.technician_id;
    if (!tid || map[tid]) return;
    if (!seenOrder.includes(tid)) seenOrder.push(tid);
    map[tid] = neonRails[seenOrder.length % neonRails.length];
  });
  return { map, order: seenOrder };
}

function serviceTypeLabel(apt) {
  const t = apt.appointment_type || apt.title || 'Service';
  if (typeof t !== 'string') return 'Service';
  return t.replace(/_/g, ' ');
}

/** Badge-only travel chip; vertical route drawn in SVG layer */
function TravelChip({ travelMins, topPct }) {
  if (!travelMins || travelMins < 8) return null;
  const mid = topPct;
  return (
    <div
      className="absolute left-[7%] -translate-x-1/2 z-[5] pointer-events-none flex justify-center"
      style={{
        top: `${mid}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-[0.08em] uppercase whitespace-nowrap backdrop-blur-md"
        style={{
          background: 'linear-gradient(180deg, rgba(8,14,26,0.92), rgba(5,10,18,0.88))',
          border: '1px solid rgba(34,211,238,0.28)',
          color: '#7EEEF8',
          boxShadow:
            '0 0 0 1px rgba(0,217,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 16px rgba(34,211,238,0.14)',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ stroke: '#22D3EE', strokeWidth: 1.5 }}>
          <path d="M5 17h14v2H5v-2z" strokeLinecap="round" />
          <path d="M7 17V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {travelMins} MIN
      </div>
    </div>
  );
}

function travelMinsInvalid(tm) {
  return !tm || tm < 8;
}

function TimelineRoutesSvg({ connectors }) {
  if (!connectors.length) return null;
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-[2]"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <filter id="routeGlowHud" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="0.55" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {connectors.map((c) => {
        const yTop = Math.min(c.y0, c.y1);
        const yBot = Math.max(c.y0, c.y1);
        const x = 8;
        return (
          <g key={c.key} filter="url(#routeGlowHud)">
            <line
              x1={x}
              y1={yTop}
              x2={x}
              y2={yBot}
              stroke="rgba(34,211,238,0.42)"
              strokeWidth={0.18}
              strokeLinecap="round"
              strokeDasharray="0.55 0.35"
              vectorEffect="non-scaling-stroke"
              style={{
                filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.45)) drop-shadow(0 0 2px rgba(34,211,238,0.65))',
              }}
            />
            <circle cx={x} cy={yTop} r={0.32} fill="rgba(34,211,238,0.95)" opacity={0.9} />
            <circle cx={x} cy={yBot} r={0.32} fill="rgba(34,211,238,0.95)" opacity={0.9} />
          </g>
        );
      })}
    </svg>
  );
}

export default function ScheduleTestTimeline({
  appointments = [],
  anchorDate,
  technicianRailMap = {},
  onSelectEvent,
}) {
  const [nowTick, setNowTick] = useState(() => new Date());
  const scrollAnchorRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNowTick(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const scrollAnchorStepIndex = TIMELINE_SCROLL_ANCHOR_HOUR - START_HOUR;

  const dayStart = useMemo(() => {
    const d = new Date(anchorDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [anchorDate]);

  const totalMins = (END_HOUR - START_HOUR) * 60;
  const slotCount = END_HOUR - START_HOUR;
  /** Taller track = clearer grid + room for WO copy (still %-positioned appointments). */
  const timelineMinHeight = slotCount * MIN_PX_PER_HOUR;

  const prepared = useMemo(() => {
    const list = (appointments || [])
      .filter((a) => a.start)
      .map((a) => {
        const start = parseISO(a.start);
        const end = a.end ? parseISO(a.end) : new Date(start.getTime() + 60 * 60 * 1000);
        return { ...a, _start: start, _end: end };
      })
      .filter((a) => isSameDay(a._start, dayStart))
      .sort((a, b) => a._start - b._start);

    return list.map((a) => {
      const startM = clamp(minsFromMidnight(a._start), START_HOUR * 60, END_HOUR * 60);
      const endM = clamp(minsFromMidnight(a._end), startM + 15, END_HOUR * 60);
      const topPct = ((startM - START_HOUR * 60) / totalMins) * 100;
      const heightPct = Math.max(4, ((endM - startM) / totalMins) * 100);
      const rail = a.technician_id ? technicianRailMap[a.technician_id] || NEON_RAILS[0] : '#64748B';
      return { ...a, topPct, heightPct, rail };
    });
  }, [appointments, dayStart, totalMins, technicianRailMap]);

  const connectors = useMemo(() => {
    const out = [];
    for (let i = 0; i < prepared.length - 1; i += 1) {
      const a = prepared[i];
      const b = prepared[i + 1];
      if (a.technician_id && a.technician_id === b.technician_id) {
        const gap = differenceInMinutes(b._start, a._end);
        const travelMins = gap > 0 ? gap : 0;
        const y0 = a.topPct + a.heightPct;
        const y1 = b.topPct;
        const midPct = y0 + (y1 - y0) / 2;
        out.push({
          key: `rt-${a.id ?? a.start}-${b.id ?? b.start}-${i}`,
          y0,
          y1,
          topPct: midPct,
          travelMins,
        });
      }
    }
    return out;
  }, [prepared]);

  const nowLinePct = useMemo(() => {
    if (!isSameDay(nowTick, dayStart)) return null;
    const m = minsFromMidnight(nowTick);
    if (m < START_HOUR * 60 || m > END_HOUR * 60) return null;
    return ((m - START_HOUR * 60) / totalMins) * 100;
  }, [nowTick, dayStart, totalMins]);

  /** Scroll window so TIMELINE_SCROLL_ANCHOR_HOUR row sits ~at top (7am stays above scroll). */
  useEffect(() => {
    if (scrollAnchorStepIndex < 1 || scrollAnchorStepIndex > slotCount) return;
    const node = scrollAnchorRef.current;
    if (!node) return;
    const id = requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'nearest' });
    });
    return () => cancelAnimationFrame(id);
  }, [anchorDate, scrollAnchorStepIndex, slotCount, timelineMinHeight]);

  const showScrollAnchor = scrollAnchorStepIndex >= 1 && scrollAnchorStepIndex <= slotCount;

  return (
    <div className="relative isolate rounded-[22px] overflow-hidden sched-timeline-hud-root" style={{ minHeight: timelineMinHeight }}>
      <TimelineGridScene slotCount={slotCount} />

      <div className="relative flex z-[2] rounded-[inherit]">
        {showScrollAnchor && (
          <div
            ref={scrollAnchorRef}
            className="pointer-events-none absolute left-0 right-0 z-[30] h-0 scroll-mt-3"
            style={{ top: `${(scrollAnchorStepIndex / slotCount) * 100}%` }}
            aria-hidden
          />
        )}
        {/* Time axis */}
        <div
          className="flex-shrink-0 w-[3.05rem] sm:w-[3.35rem] relative z-[4] scheduling-time-axis rounded-l-[18px]"
          style={{
            minHeight: timelineMinHeight,
            background: 'linear-gradient(180deg, rgba(4,11,24,0.42), rgba(2,7,14,0.58))',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow:
              'inset -1px 0 0 rgba(34,211,238,0.14), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
            const h = START_HOUR + i;
            const isFirst = i === 0;
            const isLast = i === slotCount;
            const labelTransform = isFirst ? 'translateY(0)' : isLast ? 'translateY(-100%)' : 'translateY(-50%)';
            return (
              <div
                key={h}
                className="absolute left-0 right-0 w-full tabular-nums text-right leading-none font-medium scheduling-time-label"
                style={{
                  top: `${(i / slotCount) * 100}%`,
                  transform: labelTransform,
                  paddingRight: '0.38rem',
                  fontSize: 11,
                  letterSpacing: '0.03em',
                  color: 'rgba(255,255,255,0.38)',
                  textShadow: '0 0 12px rgba(0,217,255,0.08)',
                  transition: `color 180ms cubic-bezier(${HUD_EASE.join(',')})`,
                }}
              >
                {format(new Date(2000, 0, 1, h, 0), 'h a')}
              </div>
            );
          })}
        </div>

        {/* Track — composited grid lives in TimelineGridScene; this is the interaction plane */}
        <div
          className="flex-1 relative"
          style={{
            minHeight: timelineMinHeight,
            background: 'linear-gradient(180deg, rgba(3,8,18,0.22), rgba(1,4,10,0.28))',
          }}
        >
          <TimelineRoutesSvg connectors={connectors.filter((c) => !travelMinsInvalid(c.travelMins))} />

          {connectors.map((c) => (
            <TravelChip key={c.key} travelMins={c.travelMins} topPct={c.topPct} />
          ))}

          {/* Tactical scan line — LIVE */}
          {nowLinePct != null && (
            <motion.div
              className="absolute left-0 right-0 z-[8] pointer-events-none flex items-center"
              style={{ top: `${nowLinePct}%`, transform: 'translateY(-50%)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18, ease: HUD_EASE }}
            >
              <motion.div
                className="w-3 h-3 rounded-full flex-shrink-0 ml-[-2px] sched-scan-node"
                style={{
                  background: 'linear-gradient(180deg, #FF9F4A 0%, #FF7A00 55%, #CC5F00 100%)',
                  boxShadow: '0 0 14px rgba(255,138,26,0.85), 0 0 26px rgba(255,138,26,0.45), inset 0 1px 0 rgba(255,255,255,0.35)',
                }}
                animate={{ opacity: [0.92, 1, 0.92], scale: [1, 1.04, 1] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="flex-1 rounded-full sched-scan-bar"
                style={{
                  height: 2,
                  background: 'linear-gradient(90deg, rgba(255,138,26,1), rgba(255,138,26,0.75), rgba(255,138,26,1))',
                  boxShadow:
                    '0 0 12px rgba(255,138,26,0.8), 0 0 22px rgba(255,138,26,0.35), inset 0 1px 0 rgba(255,255,255,0.25)',
                  marginLeft: 2,
                }}
                animate={{ opacity: [0.88, 1, 0.88] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="ml-2.5 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-[0.06em] flex-shrink-0"
                style={{
                  background: 'linear-gradient(180deg, rgba(22,12,6,0.98), rgba(10,6,4,0.96))',
                  border: '1px solid rgba(255,138,26,0.42)',
                  color: '#FFB04A',
                  boxShadow: '0 0 16px rgba(255,138,26,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
                }}
                animate={{ opacity: [0.9, 1, 0.9] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                {format(nowTick, 'h:mm a')}
              </motion.div>
            </motion.div>
          )}

          {prepared.map((apt, idx) => {
            const orderNum = apt.order_number ? `WO #${apt.order_number}` : apt.title || 'Job';
            const woHref = apt.work_order_id ? `/work_orders/${apt.work_order_id}` : null;
            const typeIsDiagnostic = /diagnostic/i.test(serviceTypeLabel(apt));

            return (
              <motion.button
                key={apt.id ?? `${apt.start}-${idx}`}
                type="button"
                className="sched-hud-apt absolute left-3 right-2 text-left rounded-[14px] overflow-hidden z-[6] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 group"
                style={{
                  top: `${apt.topPct}%`,
                  height: `${apt.heightPct}%`,
                  minHeight: Math.max(78, Math.round(MIN_PX_PER_HOUR * 0.82)),
                }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: Math.min(idx * 0.035, 0.22), ease: HUD_EASE }}
                onClick={() => onSelectEvent?.(apt)}
                whileHover={{
                  y: -1,
                  transition: { duration: 0.18, ease: HUD_EASE },
                }}
                whileTap={{ scale: 0.996 }}
              >
                {/* Top edge reflection */}
                <div
                  className="pointer-events-none absolute top-0 left-0 right-0 h-px z-10 opacity-40"
                  style={{
                    background: 'linear-gradient(90deg, transparent 2%, rgba(255,255,255,0.22) 50%, transparent 98%)',
                  }}
                />
                <div
                  className="relative sched-hud-inner flex h-full w-full rounded-[13px] overflow-hidden group-hover:shadow-[0_0_26px_rgba(34,211,238,0.12)]"
                  style={{
                    background: 'linear-gradient(180deg, rgba(10,18,32,0.97), rgba(5,10,20,0.97))',
                    border: '1px solid rgba(255,255,255,0.055)',
                    boxShadow:
                      '0 0 0 1px rgba(0,217,255,0.04), 0 10px 28px rgba(0,0,0,0.55), 0 0 18px rgba(34,211,238,0.07), inset 0 1px 0 rgba(255,255,255,0.04)',
                    transition: `box-shadow 180ms cubic-bezier(${HUD_EASE.join(',')}), transform 180ms cubic-bezier(${HUD_EASE.join(',')})`,
                  }}
                >
                  <div
                    className="flex-shrink-0 h-full ml-1 my-1 rounded-full"
                    style={{
                      width: 5,
                      background: apt.rail,
                      boxShadow: `0 0 18px ${apt.rail}, 0 0 8px ${apt.rail}99`,
                    }}
                  />
                  <div className="flex-1 min-w-0 py-2.5 pl-3 pr-2 flex gap-2.5 items-stretch">
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className="text-[12px] font-bold tracking-[-0.02em] leading-tight"
                          style={{ color: 'rgba(255,255,255,0.96)' }}
                        >
                          {orderNum}
                        </span>
                        <span className="sched-hud-status inline-flex [&>span]:!text-[9px] [&>span]:!leading-tight [&>span]:!font-bold [&>span]:!tracking-[0.08em] [&>span]:!uppercase [&>span]:!rounded-md [&>span]:!px-2 [&>span]:!py-0.5 [&>span]:!border [&>span]:!border-purple-400/25 [&>span]:!bg-[rgba(168,85,247,0.14)] [&>span]:!text-[#E9D5FF] [&>span]:!shadow-[0_0_12px_rgba(168,85,247,0.12)]">
                          <StatusBadge status={apt.status || 'scheduled'} />
                        </span>
                        <span
                          className="text-[9px] font-bold px-2 py-0.5 rounded-md tracking-[0.06em] uppercase leading-tight border border-cyan-400/22"
                          style={{
                            background: typeIsDiagnostic ? 'rgba(34,211,238,0.12)' : 'rgba(168,85,247,0.1)',
                            color: typeIsDiagnostic ? '#A5F3FC' : '#DDD6FE',
                            boxShadow: typeIsDiagnostic
                              ? '0 0 12px rgba(34,211,238,0.12)'
                              : '0 0 12px rgba(168,85,247,0.1)',
                          }}
                        >
                          {serviceTypeLabel(apt)}
                        </span>
                      </div>
                      <p className="text-[11px] leading-snug tracking-wide" style={{ color: 'rgba(255,255,255,0.58)' }}>
                        {format(apt._start, 'h:mm a')}
                        {apt._end ? ` – ${format(apt._end, 'h:mm a')}` : ''}
                      </p>
                      <p className="text-[13px] font-medium leading-tight truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
                        {apt.client_name || 'Client'}
                      </p>
                      {apt.client_phone && (
                        <p className="text-[10px] leading-tight truncate" style={{ color: 'rgba(255,255,255,0.34)' }}>
                          {apt.client_phone}
                        </p>
                      )}
                      <p className="text-[10px] leading-tight truncate" style={{ color: 'rgba(255,255,255,0.32)' }}>
                        {apt.technician_name || 'Unassigned'}
                      </p>
                    </div>
                    <div className="flex flex-col items-center justify-center flex-shrink-0">
                      {woHref ? (
                        <a
                          href={woHref}
                          onClick={(e) => e.stopPropagation()}
                          className="w-10 h-10 rounded-xl flex items-center justify-center sched-hud-action"
                          style={{
                            border: '1px solid rgba(34,211,238,0.22)',
                            background: 'linear-gradient(180deg, rgba(6,14,24,0.95), rgba(3,8,16,0.92))',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                            transition: `all 180ms cubic-bezier(${HUD_EASE.join(',')})`,
                          }}
                          aria-label="Open work order"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: '#22D3EE', strokeWidth: 2 }}>
                            <polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </a>
                      ) : (
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(3,8,18,0.6)' }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 2 }}>
                            <polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}

          {prepared.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-[3] px-6 text-center">
              <p className="text-sm tracking-wide" style={{ color: 'rgba(255,255,255,0.36)' }}>
                No jobs in this window — adjust date or filters.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
