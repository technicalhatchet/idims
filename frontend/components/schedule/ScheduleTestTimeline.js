import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO, differenceInMinutes, isSameDay } from 'date-fns';
import StatusBadge from '../ui/StatusBadge';

/** Business window (local clock) displayed on tactical grid */
const START_HOUR = 7;
const END_HOUR = 19;

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

/** Travel connector between sequential jobs same tech */
function RouteConnector({ topPct, heightPct, travelMins }) {
  if (!travelMins || travelMins < 8) return null;
  return (
    <div
      className="absolute left-4 right-12 z-[1] pointer-events-none flex flex-col items-center justify-center gap-2"
      style={{
        top: `${topPct}%`,
        height: `${heightPct}%`,
        minHeight: 44,
      }}
    >
      <div
        className="flex-1 w-px rounded-full"
        style={{
          background:
            'linear-gradient(180deg, rgba(34,211,238,0.05), rgba(34,211,238,0.55), rgba(34,211,238,0.05))',
          boxShadow: '0 0 10px rgba(34,211,238,0.35)',
        }}
      />
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase whitespace-nowrap"
        style={{
          background: 'rgba(8,14,26,0.85)',
          border: '1px solid rgba(34,211,238,0.28)',
          color: '#22D3EE',
          boxShadow:
            '0 0 0 1px rgba(0,217,255,0.06), 0 0 18px rgba(34,211,238,0.14)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ stroke: '#22D3EE', strokeWidth: 1.5 }}>
          <path d="M5 17h14v2H5v-2z" strokeLinecap="round"/>
          <path d="M7 17V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="8" cy="14" r="1" fill="#22D3EE"/>
          <circle cx="16" cy="14" r="1" fill="#22D3EE"/>
        </svg>
        {travelMins} MIN TRAVEL
      </div>
      <div
        className="flex-1 w-px rounded-full"
        style={{
          background:
            'linear-gradient(180deg, rgba(34,211,238,0.05), rgba(34,211,238,0.55), rgba(34,211,238,0.05))',
          boxShadow: '0 0 10px rgba(34,211,238,0.35)',
        }}
      />
    </div>
  );
}

export default function ScheduleTestTimeline({
  appointments = [],
  anchorDate,
  technicianRailMap = {},
  onSelectEvent,
}) {
  const [nowTick, setNowTick] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNowTick(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const dayStart = useMemo(() => {
    const d = new Date(anchorDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [anchorDate]);

  const totalMins = (END_HOUR - START_HOUR) * 60;
  const slotCount = END_HOUR - START_HOUR;

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
        const topPct = a.topPct + a.heightPct;
        const heightPct = Math.max(2, b.topPct - topPct);
        out.push({
          key: `c-${a.id ?? a.start}-${b.id ?? b.start}-${i}`,
          topPct,
          heightPct,
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

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: 520 }}>
      {/* Tactical grid background */}
      <div
        className="absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(34,211,238,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,211,238,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '100% 48px, 24px 100%',
        }}
      />

      <div className="relative flex">
        {/* Time axis */}
        <div
          className="flex-shrink-0 w-11 sm:w-12 border-r border-white/[0.06] relative z-[2]"
          style={{ background: 'rgba(3,8,18,0.4)', minHeight: 520 }}
        >
          {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
            const h = START_HOUR + i;
            return (
              <div
                key={h}
                className="absolute left-0 right-0 text-[10px] sm:text-xs font-medium tabular-nums text-right pr-1.5 sm:pr-2"
                style={{
                  top: `${(i / slotCount) * 100}%`,
                  transform: 'translateY(-50%)',
                  color: 'rgba(255,255,255,0.38)',
                }}
              >
                {format(new Date(2000, 0, 1, h, 0), 'h a')}
              </div>
            );
          })}
        </div>

        {/* Track */}
        <div className="flex-1 relative min-h-[520px]">
          {/* Hour faint lines */}
          <div className="absolute inset-0 flex flex-col pointer-events-none">
            {Array.from({ length: slotCount }, (_, i) => (
              <div key={i} className="flex-1 border-b border-dotted border-cyan-500/10" />
            ))}
          </div>

          {/* Current time — orange scan line */}
          {nowLinePct != null && (
            <motion.div
              className="absolute left-0 right-0 z-[4] pointer-events-none flex items-center"
              style={{ top: `${nowLinePct}%` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div
                className="h-2 w-2 rounded-full flex-shrink-0 -ml-1"
                style={{
                  background: '#FF7A00',
                  boxShadow: '0 0 12px rgba(255,122,0,0.9), 0 0 24px rgba(255,122,0,0.4)',
                }}
              />
              <div
                className="flex-1 h-px"
                style={{
                  background:
                    'repeating-linear-gradient(90deg, rgba(255,122,0,0.9) 0, rgba(255,122,0,0.9) 6px, transparent 6px, transparent 12px)',
                  boxShadow: '0 0 10px rgba(255,122,0,0.35)',
                }}
              />
              <motion.div
                className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide flex-shrink-0"
                style={{
                  background: 'rgba(12,8,4,0.92)',
                  border: '1px solid rgba(255,122,0,0.45)',
                  color: '#FF7A00',
                  boxShadow: '0 0 14px rgba(255,122,0,0.25)',
                }}
                animate={{ opacity: [0.85, 1, 0.85] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                {format(nowTick, 'h:mm a')}
              </motion.div>
            </motion.div>
          )}

          {connectors.map((c) => (
            <RouteConnector key={c.key} topPct={c.topPct} heightPct={c.heightPct} travelMins={c.travelMins} />
          ))}

          {prepared.map((apt, idx) => {
            const orderNum = apt.order_number ? `WO #${apt.order_number}` : apt.title || 'Job';
            const woHref = apt.work_order_id ? `/work_orders/${apt.work_order_id}` : null;

            return (
              <motion.button
                key={apt.id ?? `${apt.start}-${idx}`}
                type="button"
                className="absolute left-2 right-2 text-left rounded-xl overflow-hidden z-[3] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
                style={{
                  top: `${apt.topPct}%`,
                  height: `${apt.heightPct}%`,
                  minHeight: 72,
                }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.04 }}
                onClick={() => onSelectEvent?.(apt)}
                whileTap={{ scale: 0.995 }}
              >
                <div
                  className="flex h-full w-full group"
                  style={{
                    background: 'rgba(8,14,26,0.92)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    boxShadow:
                      '0 0 0 1px rgba(34,211,238,0.05), 0 8px 20px rgba(0,0,0,0.35), 0 0 18px rgba(34,211,238,0.06)',
                  }}
                >
                  <div className="w-1 flex-shrink-0 h-full" style={{ background: apt.rail, boxShadow: `0 0 12px ${apt.rail}55` }} />
                  <div className="flex-1 min-w-0 py-2 pl-3 pr-2 flex gap-2 items-stretch">
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-white/95 tracking-tight">{orderNum}</span>
                        <StatusBadge status={apt.status || 'scheduled'} />
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
                          style={{
                            background: 'rgba(168,85,247,0.12)',
                            border: '1px solid rgba(168,85,247,0.28)',
                            color: '#D8B4FE',
                          }}
                        >
                          {serviceTypeLabel(apt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/55">
                        {format(apt._start, 'h:mm a')}
                        {apt._end ? ` – ${format(apt._end, 'h:mm a')}` : ''}
                      </p>
                      <p className="text-sm font-medium text-white/90 truncate">{apt.client_name || 'Client'}</p>
                      {apt.client_phone && (
                        <p className="text-[11px] text-cyan-400/80 truncate">{apt.client_phone}</p>
                      )}
                      <p className="text-[11px] text-white/40 truncate">{apt.technician_name || 'Unassigned'}</p>
                    </div>
                    <div className="flex flex-col items-center justify-center flex-shrink-0">
                      {woHref ? (
                        <a
                          href={woHref}
                          onClick={(e) => e.stopPropagation()}
                          className="w-9 h-9 rounded-lg flex items-center justify-center transition-all group-hover:shadow-[0_0_14px_rgba(34,211,238,0.25)]"
                          style={{ border: '1px solid rgba(34,211,238,0.25)', background: 'rgba(3,8,18,0.8)' }}
                          aria-label="Open work order"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: '#22D3EE', strokeWidth: 2 }}>
                            <polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </a>
                      ) : (
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center"
                          style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(3,8,18,0.5)' }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: 'rgba(255,255,255,0.25)', strokeWidth: 2 }}>
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
            <div className="absolute inset-0 flex items-center justify-center z-[2] px-6 text-center">
              <p className="text-sm text-white/40">No jobs in this window — adjust date or filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
