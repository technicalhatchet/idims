import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
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
const MIN_PX_PER_HOUR = 125;

/** Align this hour’s band to the viewport top after mount (scrolls page; hides cut-off earlier hour labels). */
const TIMELINE_SCROLL_ANCHOR_HOUR = 8;

const HUD_EASE = [0.4, 0, 0.2, 1];

/** Appliance chip — aligns with route / landing orange (#FFB86C, #FF7A00 family); light text on dark glass */
export const SCHEDULE_EQUIP_BADGE_STYLE = {
  background: 'linear-gradient(180deg, rgba(255,138,26,0.1), rgba(255,118,46,0.05))',
  color: '#FFDCC8',
  boxShadow:
    'inset 0 0 0 0.5px rgba(255,190,154,0.45), 0 0 10px rgba(255,138,26,0.14)',
};

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

/** Display label for serviced equipment (subtype preferred, then type). */
export function formatEquipmentSubtypeLabel(apt) {
  const raw = apt?.equipment_subtype ?? apt?.equipment_type;
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim().replace(/_/g, ' ');
  return s.length ? s : null;
}

const SCHEDULE_STATUS_BADGE_WRAP_CLASS =
  'sched-hud-status inline-flex [&>span]:!text-[8px] [&>span]:!leading-[1.1] [&>span]:!font-bold [&>span]:!tracking-[0.07em] [&>span]:!uppercase [&>span]:!rounded [&>span]:!px-[5px] [&>span]:!py-[1px] [&>span]:!border-[0.5px] [&>span]:!border-solid [&>span]:!border-[rgba(168,85,247,0.42)] [&>span]:!bg-[rgba(168,85,247,0.12)] [&>span]:!text-[#E9D5FF] [&>span]:!shadow-[0_0_10px_rgba(168,85,247,0.1)]';

/** Status (top), appointment type (mid), equipment subtype (bottom) — right column */
export function AppointmentCardBadgeStack({ status = 'scheduled', appointmentTypeLabel, typeIsDiagnostic, equipLabel }) {
  return (
    <div className="flex flex-col items-end gap-0.5 flex-shrink-0 text-right">
      <span className={SCHEDULE_STATUS_BADGE_WRAP_CLASS}>
        <StatusBadge status={status} />
      </span>
      <span
        className="inline-flex justify-end max-w-[9.5rem] truncate text-[8px] font-bold px-[5px] py-[1px] rounded tracking-[0.05em] uppercase leading-tight"
        style={{
          background: typeIsDiagnostic ? 'rgba(34,211,238,0.1)' : 'rgba(168,85,247,0.09)',
          color: typeIsDiagnostic ? '#A5F3FC' : '#DDD6FE',
          boxShadow: typeIsDiagnostic
            ? 'inset 0 0 0 0.5px rgba(34,211,238,0.42), 0 0 8px rgba(34,211,238,0.1)'
            : 'inset 0 0 0 0.5px rgba(168,85,247,0.42), 0 0 8px rgba(168,85,247,0.09)',
        }}
      >
        {appointmentTypeLabel}
      </span>
      {equipLabel ? (
        <span
          className="inline-flex justify-end max-w-[9.5rem] truncate text-[8px] font-bold px-[5px] py-[1px] rounded tracking-[0.05em] uppercase leading-tight"
          style={SCHEDULE_EQUIP_BADGE_STYLE}
          title={equipLabel}
        >
          {equipLabel}
        </span>
      ) : null}
    </div>
  );
}

/** ~width of one stacked HUD badge chip column; shrinks apt card inset from track edge */
const HUD_APPOINTMENT_CARD_RIGHT_INSET = '5.75rem';

/** Timeline route gutter spine (% from left): trunk + elbows + horizontal arms share this anchor */
const ROUTE_GUTTER_X_PCT = 92;

/** Px stroke for solid trunk / arms (`TravelRouteOrthoLayer`) */
const ROUTE_TRUNK_STROKE_PX = 2;

/** Share of travel-gap height reserved as hollow band around van on spine (~total vertical gap carved) */
const ROUTE_VAN_SPINE_VERTICAL_CLEAR_FRAC = 0.35;

/** Glow + silhouette shared by all spine junction hoops (job elbows + van branch points) */
const ROUTE_JUNCTION_RING_GLOW =
  '0 0 6px rgba(34,211,238,0.45), inset 0 0 4px rgba(34,211,238,0.08)';

/** Shorten spine near van hoops (% of timeline) so line/glow doesn’t pierce the ring */
const ROUTE_SPINE_VAN_GAP_PCT = 0.12;

/** Spine carve around travel van: splits vertical trunk above/below `midY` (van center %). */
function vanSpineCarveBands(yTop, yBot, midY) {
  const eps = 0.06;
  const gap = yBot - yTop;
  if (gap < eps * 3) return { carveTop: yTop, carveBot: yBot, splitOk: false };

  let halfBand = (gap * ROUTE_VAN_SPINE_VERTICAL_CLEAR_FRAC) / 2;
  halfBand = clamp(halfBand, 0.32, gap / 2 - eps);

  let carveTop = midY - halfBand;
  let carveBot = midY + halfBand;
  carveTop = Math.max(carveTop, yTop + eps);
  carveBot = Math.min(carveBot, yBot - eps);

  if (carveTop >= carveBot - eps) return { carveTop: yTop, carveBot: yBot, splitOk: false };

  const upperH = carveTop - yTop;
  const lowerH = yBot - carveBot;
  if (upperH < 0.12 && lowerH < 0.12) return { carveTop: yTop, carveBot: yBot, splitOk: false };

  return { carveTop, carveBot, splitOk: true };
}

/**
 * Gap spine for dashed line + endpoint dots (% of track height).
 * yLo / yHi are connectors’ anchor band (prior job bottom → next job top).
 * Outward frac nudges terminals slightly toward the jobs → visually longer spine, dots farther apart.
 */
const ROUTE_DOT_OUTWARD_FRAC = 2.07;

/** yTop < yBot along track; dashed line shares same endpoints as DOM dots */
function routeTravelSpineEndpoints(y0, y1) {
  const yLo = Math.min(y0, y1);
  const yHi = Math.max(y0, y1);
  const gap = yHi - yLo;
  if (gap <= 0.08) return { yTop: yLo, yBot: yHi };
  const out = gap * ROUTE_DOT_OUTWARD_FRAC;
  let yTop = yLo - out;
  let yBot = yHi + out;
  yTop = Math.max(yTop, 0.35);
  yBot = Math.min(yBot, 99.65);
  if (yTop >= yBot - 0.05) return { yTop: yLo, yBot: yHi };
  return { yTop, yBot };
}

/** Tune when minutes sit on top of the van glazing (lower = quieter behind text). */
const TRAVEL_VAN_GLASS = { windowOpacity: 0.28, windshieldOpacity: 0.34, doorOpacity: 0.2 };

/** ViewBox‑unit nudge for filled neon dots (optical center on body vs stroke outline). */
const TRAVEL_VAN_NEON_NUDGE_X = 4;

/** Stroke van icon for travel chip; uses currentColor from parent */
function TravelVanGlyph({
  className,
  windowOpacity = TRAVEL_VAN_GLASS.windowOpacity,
  windshieldOpacity = TRAVEL_VAN_GLASS.windshieldOpacity,
  doorOpacity = TRAVEL_VAN_GLASS.doorOpacity,
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 256 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M38 82 L48 56 Q52 46 64 46 H146 Q164 46 176 56 L198 72 Q206 76 206 84 V90 H198 Q196 102 184 102 Q172 102 170 90 H82 Q80 102 68 102 Q56 102 54 90 H40 Q34 90 34 84 Q34 82 38 82 Z"
        stroke="currentColor"
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path
        d="M66 54 H142 Q152 52 164 60 L176 71 H58 Z"
        stroke="currentColor"
        strokeWidth={3}
        opacity={windowOpacity}
        strokeLinejoin="round"
      />
      <path
        d="M168 50L182 71H194"
        stroke="currentColor"
        strokeWidth={2.5}
        opacity={windshieldOpacity}
        strokeLinecap="round"
      />
      <path
        d="M122 54V90"
        stroke="currentColor"
        strokeWidth={2}
        opacity={doorOpacity}
        strokeLinecap="round"
      />
      <path d="M84 71H108" stroke="currentColor" strokeWidth={2} opacity={0.35} strokeLinecap="round" />
      <path d="M138 71H158" stroke="currentColor" strokeWidth={2} opacity={0.35} strokeLinecap="round" />
      <path d="M194 80H202" stroke="currentColor" strokeWidth={2} opacity={0.7} strokeLinecap="round" />
      <circle cx={68} cy={90} r={14} stroke="currentColor" strokeWidth={4} />
      <circle cx={184} cy={90} r={14} stroke="currentColor" strokeWidth={4} />
      <circle cx={68} cy={90} r={5} stroke="currentColor" strokeWidth={2} opacity={0.5} />
      <circle cx={184} cy={90} r={5} stroke="currentColor" strokeWidth={2} opacity={0.5} />
      <g transform={`translate(${TRAVEL_VAN_NEON_NUDGE_X} 0)`}>
        <circle cx={64} cy={46} r={2} fill="currentColor" />
        <circle cx={176} cy={56} r={2} fill="currentColor" />
        <circle cx={38} cy={82} r={2} fill="currentColor" />
      </g>
    </svg>
  );
}

/** Badge-only travel chip; sits in track right gutter; vertical route in SVG layer */
function TravelChip({ travelMins, topPct }) {
  if (!travelMins || travelMins < 8) return null;
  const mid = topPct;
  return (
    <div
      className="absolute z-[5] pointer-events-none flex justify-end px-0 pl-1"
      style={{
        top: `${mid}%`,
        right: '0.15rem',
        width: HUD_APPOINTMENT_CARD_RIGHT_INSET,
        transform: 'translate(10px, -50%)',
      }}
    >
      <div
        className="relative w-full"
        style={{ aspectRatio: '2 / 1', color: '#6EEAF4' }}
      >
        <TravelVanGlyph className="pointer-events-none absolute inset-0 block h-full w-full" />
        <span
          className="pointer-events-none absolute left-[49%] top-[52%] -translate-x-1/2 -translate-y-1/2 text-[8px] font-normal tabular-nums tracking-[0.07em] uppercase whitespace-nowrap"
          style={{
            color: '#E8FDFF',
            WebkitTextStroke: '0.26px rgba(255,154,92,0.62)',
            textShadow: '0 0 7px rgba(255,154,92,0.28), 0 0 3px rgba(255,138,26,0.2), 0 1px 2px rgba(0,0,0,0.9)',
          }}
        >
          {travelMins} MIN
        </span>
      </div>
    </div>
  );
}

function travelMinsInvalid(tm) {
  return !tm || tm < 8;
}

/** Orthogonal Π / L-route: solid trunk + arms; spine splits above/below travel van (+ van-side junction rings). */
function TravelRouteOrthoLayer({ connectors }) {
  if (!connectors.length) return null;

  const spineFromRight = `${100 - ROUTE_GUTTER_X_PCT}%`;
  const cardEdge = `calc(100% - 0.5rem - ${HUD_APPOINTMENT_CARD_RIGHT_INSET})`;
  const cyan = 'rgba(34,211,238,0.68)';
  const glow = '0 0 7px rgba(34,211,238,0.38), 0 0 2px rgba(34,211,238,0.55)';
  const half = ROUTE_TRUNK_STROKE_PX / 2;
  const vanGap = ROUTE_SPINE_VAN_GAP_PCT;

  const vanBranchRing = (cKey, y, suf) => (
    <div
      key={`${cKey}-van-ring-${suf}`}
      aria-hidden
      className="pointer-events-none absolute z-[4] rounded-full"
      style={{
        left: `${ROUTE_GUTTER_X_PCT}%`,
        top: `${y}%`,
        width: 9,
        height: 9,
        transform: 'translate(-50%, -50%)',
        border: `2px solid rgba(56,229,239,0.92)`,
        background: 'rgba(8,14,26,0.35)',
        boxShadow: ROUTE_JUNCTION_RING_GLOW,
        backdropFilter: 'blur(4px)',
      }}
    />
  );

  return connectors.flatMap((c) => {
    const { yTop, yBot } = routeTravelSpineEndpoints(c.y0, c.y1);
    const midY = c.topPct;
    const { carveTop, carveBot, splitOk } = vanSpineCarveBands(yTop, yBot, midY);

    const spineSeg = (suffix, segTopPct, spanPct) => (
      <div
        key={`${c.key}-spine-${suffix}`}
        aria-hidden
        className="pointer-events-none absolute z-[2]"
        style={{
          left: `calc(${ROUTE_GUTTER_X_PCT}% - ${half}px)`,
          width: ROUTE_TRUNK_STROKE_PX,
          top: `${segTopPct}%`,
          height: `${Math.max(spanPct, 0.04)}%`,
          background: cyan,
          borderRadius: 1,
          boxShadow: glow,
        }}
      />
    );

    const arm = (y, suf) => (
      <div
        key={`${c.key}-arm-${suf}`}
        aria-hidden
        className="pointer-events-none absolute z-[2]"
        style={{
          top: `${y}%`,
          left: cardEdge,
          right: spineFromRight,
          height: ROUTE_TRUNK_STROKE_PX,
          transform: 'translateY(-50%)',
          background: cyan,
          borderRadius: 1,
          boxShadow: glow,
        }}
      />
    );

    const spineParts = [];
    if (!splitOk) {
      spineParts.push(spineSeg('full', yTop, yBot - yTop));
    } else {
      const uh = carveTop - yTop;
      const lh = yBot - carveBot;
      if (uh >= 0.06) {
        spineParts.push(spineSeg('u', yTop, Math.max(uh - vanGap, 0.06)));
      }
      if (lh >= 0.06) {
        spineParts.push(spineSeg('l', carveBot + vanGap, Math.max(lh - vanGap, 0.06)));
      }
      spineParts.push(vanBranchRing(c.key, carveTop, 't'));
      spineParts.push(vanBranchRing(c.key, carveBot, 'b'));
    }

    return [...spineParts, arm(yTop, 't'), arm(yBot, 'b')];
  });
}

/**
 * Hollow rings on elbows (matches reference junctions).
 * Keeps circular — DOM positioning, avoids SVG ellipse stretch under preserveAspectRatio=none on track.
 */
function TravelRouteEndpointMarkers({ connectors }) {
  if (!connectors.length) return null;

  const ringGlow = ROUTE_JUNCTION_RING_GLOW;
  return connectors.map((c) => {
    const { yTop, yBot } = routeTravelSpineEndpoints(c.y0, c.y1);
    const ring = (y, suf) => (
      <div
        key={`${c.key}-ring-${suf}`}
        aria-hidden
        className="pointer-events-none absolute z-[4] rounded-full"
        style={{
          left: `${ROUTE_GUTTER_X_PCT}%`,
          top: `${y}%`,
          width: 9,
          height: 9,
          transform: 'translate(-50%, -50%)',
          border: `2px solid rgba(56,229,239,0.92)`,
          background: 'rgba(8,14,26,0.35)',
          boxShadow: ringGlow,
          backdropFilter: 'blur(4px)',
        }}
      />
    );
    return (
      <Fragment key={`${c.key}-ep`}>
        {ring(yTop, 't')}
        {ring(yBot, 'b')}
      </Fragment>
    );
  });
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

  const visibleRouteConnectors = useMemo(
    () => connectors.filter((c) => !travelMinsInvalid(c.travelMins)),
    [connectors],
  );

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
          <TravelRouteOrthoLayer connectors={visibleRouteConnectors} />
          <TravelRouteEndpointMarkers connectors={visibleRouteConnectors} />

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
            const orderLabel = apt.order_number ? String(apt.order_number).trim() : apt.title || 'Job';
            const clientLine = apt.client_name || 'Client';
            const typeIsDiagnostic = /diagnostic/i.test(serviceTypeLabel(apt));
            const equipLabel = formatEquipmentSubtypeLabel(apt);

            return (
              <motion.button
                key={apt.id ?? `${apt.start}-${idx}`}
                type="button"
                className="sched-hud-apt absolute left-3 text-left rounded-[14px] overflow-hidden z-[6] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 group"
                style={{
                  top: `${apt.topPct}%`,
                  height: `${apt.heightPct}%`,
                  minHeight: Math.max(78, Math.round(MIN_PX_PER_HOUR * 0.82)),
                  right: `calc(0.5rem + ${HUD_APPOINTMENT_CARD_RIGHT_INSET})`,
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
                    className="flex-shrink-0 h-full self-stretch ml-1 rounded-full"
                    style={{
                      alignSelf: 'stretch',
                      width: 5,
                      minHeight: '100%',
                      background: apt.rail,
                      boxShadow: `0 0 18px ${apt.rail}, 0 0 8px ${apt.rail}99`,
                    }}
                  />
                  <div className="flex-1 min-w-0 py-2 pl-2 pr-2 flex flex-row justify-between gap-2 items-center">
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 translate-x-[5px]">
                      <span
                        className="text-[13px] font-bold tracking-[-0.02em] leading-tight truncate min-w-0"
                        style={{ color: 'rgba(255,255,255,0.96)' }}
                      >
                        {clientLine}
                      </span>
                      <p className="text-[10px] leading-snug tracking-wide" style={{ color: 'rgba(255,255,255,0.58)' }}>
                        {format(apt._start, 'h:mm a')}
                        {apt._end ? ` – ${format(apt._end, 'h:mm a')}` : ''}
                      </p>
                      {apt.client_phone && (
                        <p className="text-[9px] leading-tight truncate" style={{ color: 'rgba(255,255,255,0.34)' }}>
                          {apt.client_phone}
                        </p>
                      )}
                      <p className="text-[10px] font-medium leading-tight truncate" style={{ color: 'rgba(255,255,255,0.72)' }}>
                        {orderLabel}
                      </p>
                    </div>
                    <AppointmentCardBadgeStack
                      status={apt.status || 'scheduled'}
                      appointmentTypeLabel={serviceTypeLabel(apt)}
                      typeIsDiagnostic={typeIsDiagnostic}
                      equipLabel={equipLabel}
                    />
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
