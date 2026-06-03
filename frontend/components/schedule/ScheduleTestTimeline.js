import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO, differenceInMinutes, isSameDay } from 'date-fns';
import StatusBadge from '../ui/StatusBadge';
import LoadingSpinner from '../ui/LoadingSpinner';
import {
  CALENDAR_BLOCK_ACCENT,
  calendarBlockTypeLabel,
  isCalendarBlockEvent,
} from '../../utils/calendarBlockTypes';

/** Business window start (hour) — labels + grid reference this clock hour. */
const START_HOUR = 8;
/** Business window end (hour) — grid extends through this hour (e.g. 18 ⇒ 6 PM band). */
const END_HOUR = 18;

/**
 * Minutes past `START_HOUR` where the tactical grid begins (e.g. 40 ⇒ 8:40).
 * Shrinks empty space before typical first jobs (~9) while keeping some pre‑9 grid visible.
 */
const TIMELINE_START_OFFSET_MINS = 40;

/** Absolute minutes from midnight: first row of the grid (START_HOUR:00 + offset). */
const TIMELINE_DAY_START_MINS = START_HOUR * 60 + TIMELINE_START_OFFSET_MINS;

/** Length of the visible day strip on the timeline (minutes). */
const TIMELINE_DAY_TOTAL_MINS = END_HOUR * 60 - TIMELINE_DAY_START_MINS;

/** Scroll anchor: hour row aligned to top on mount (local time). 9 = first real job band. */
const TIMELINE_SCROLL_ANCHOR_HOUR = 9;

/** % from top for `TIMELINE_SCROLL_ANCHOR_HOUR` (scroll-into-view target). */
const SCHEDULE_SCROLL_ANCHOR_PCT =
  ((TIMELINE_SCROLL_ANCHOR_HOUR * 60 - TIMELINE_DAY_START_MINS) / TIMELINE_DAY_TOTAL_MINS) * 100;

/**
 * Minor grid = 10-minute ticks (`TIMELINE_DAY_TOTAL_MINS` / 10 steps).
 * Major grid = clock hours via `TIMELINE_HOUR_MAJOR_GRADIENT`.
 */
const TIMELINE_MINOR_STEP_MINS = 10;

/** Minimum px per hour on the timeline — more vertical room for WO detail */
const MIN_PX_PER_HOUR = 125;

const HUD_EASE = [0.4, 0, 0.2, 1];

/** Time-axis gutter width — reuse in timeline header strip so divider lines up with the grid */
export const SCHED_TIMELINE_TIME_AXIS_COLUMN =
  'w-[3.05rem] sm:w-[3.35rem] flex-shrink-0';

/** Must match `.sched-hud-today-btn…::after { animation: … sched-hud-today-sweep-move 0.8s }` below */
const SCHED_HUD_TODAY_SWEEP_MS = 800;

/** Fused HUD shell — tighter than legacy 22px for a squarer tactical frame */
const HUD_SHELL_RADIUS_CLASS = 'rounded-[10px]';

const hudShellChrome = {
  border: '1px solid rgba(0,217,255,0.14)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 28px rgba(0,217,255,0.06), 0 8px 24px rgba(0,0,0,0.35)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
};

/** Chevrons: stroke only — glow handled by sched-hud-neon-glow-cyan wrappers (matches icon-test Neon Lab) */
function HudNavChevron({ direction }) {
  const pathD = direction === 'left' ? 'M28 14L18 24L28 34' : 'M20 14L30 24L20 34';
  return (
    <svg width={28} height={28} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path className="sched-hud-neon-chevron" d={pathD} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Appliance chip — aligns with route / landing orange (#FFB86C, #FF7A00 family); light text on dark glass */
export const SCHEDULE_EQUIP_BADGE_STYLE = {
  background: 'linear-gradient(180deg, rgba(255,138,26,0.1), rgba(255,118,46,0.05))',
  color: '#FFDCC8',
  boxShadow:
    'inset 0 0 0 0.5px rgba(255,190,154,0.45), 0 0 10px rgba(255,138,26,0.14)',
};

const TIMELINE_TOTAL_MINOR_STEPS = TIMELINE_DAY_TOTAL_MINS / TIMELINE_MINOR_STEP_MINS;

/** Strong hour lines at real clock hours (aligns with appointment %-time). */
function buildTimelineHourMajorGradient() {
  const line = 'rgba(0,217,255,0.145)';
  const segs = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    const p = ((h * 60 - TIMELINE_DAY_START_MINS) / TIMELINE_DAY_TOTAL_MINS) * 100;
    if (p < 0 || p > 100) continue;
    const lo = Math.max(0, p - 0.12);
    const hi = Math.min(100, p + 0.12);
    segs.push(`transparent ${lo}%`, `${line} ${p}%`, `transparent ${hi}%`);
  }
  return `linear-gradient(to bottom, ${segs.join(', ')})`;
}

const TIMELINE_HOUR_MAJOR_GRADIENT = buildTimelineHourMajorGradient();

/** Composited FUI-style grid: 10-minute minors + clock-aligned hour majors */
function TimelineGridScene() {
  const totalSteps = TIMELINE_TOTAL_MINOR_STEPS;
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
      {/* L4 — minor horizontal: 10-minute steps (full day strip) */}
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
      {/* L5 — hour majors (clock-aligned; matches axis labels + %-positioned cards) */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.92,
          backgroundImage: TIMELINE_HOUR_MAJOR_GRADIENT,
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

/** Shift spine + junction hoops left from % anchor (arms use matching `right:`); smaller = farther right */
const ROUTE_SPINE_ENDPT_NUDGE_PX = 6;

/** Positive = move route spine, arms & junction hoops down slightly (px) */
const ROUTE_ROUTE_VERT_NUDGE_PX = 2;

/** Px stroke for solid trunk / arms (`TravelRouteOrthoLayer`) */
const ROUTE_TRUNK_STROKE_PX = 2;

/** Arm diagonal: earlier-job connector tilts one way, later-job the other (see `TravelRouteOrthoLayer`). */
const ROUTE_ARM_TILT_DEG = 28;

/** Fraction of inter-job span for van cutout (scaled up on long gaps); floored by min gap */
const ROUTE_TRUNK_VAN_CLEAR_FRAC = 0.36;

/** Minimum empty band at van (% of timeline height) — target size; may shrink when span is tight */
const ROUTE_TRUNK_VAN_GAP_MIN_PCT = 2.05;

/**
 * Minimum vertical spine **shaft** above and below the van cutout (% of timeline height).
 * Reserves trunk space on **short** job gaps so the route keeps the same Π silhouette as on
 * long gaps (instead of van-only + steep arms with no vertical shaft).
 */
const ROUTE_TRUNK_SPINE_MIN_PCT = 0.38;

/** Below this cutout height (%), omit the trunk entirely (span too tight for hole + shafts). */
const ROUTE_TRUNK_VAN_HOLE_HIDE_BELOW_PCT = 0.42;

/** Tune when minutes sit on top of the van glazing (lower = quieter behind text). */
const TRAVEL_VAN_GLASS = { windowOpacity: 0.28, windshieldOpacity: 0.34, doorOpacity: 0.2 };

/** ViewBox‑unit nudge for filled neon dots (optical center on body vs stroke outline). */
const TRAVEL_VAN_NEON_NUDGE_X = 4;

/** Minutes label on travel van — warm orange (readable on cyan + dark HUD) */
const TRAVEL_CHIP_MINUTES_COLOR = '#F5A524';

/** Subtracted from raw calendar gap **only** for the “NN MIN” label (route math unchanged). */
const TRAVEL_CHIP_LABEL_SUBTRACT_MINS = 10;

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
        strokeLinejoin="round"
        strokeLinecap="butt"
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
  const labelMins = Math.max(0, travelMins - TRAVEL_CHIP_LABEL_SUBTRACT_MINS);
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
      <div className="relative w-full overflow-visible" style={{ aspectRatio: '2 / 1', color: '#6EEAF4' }}>
        <div
          aria-hidden
          className="pointer-events-none absolute left-[48%] top-[52%] z-0 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: '5.555rem',
            height: '2.750rem',
            background:
              'radial-gradient(ellipse 70% 65% at 50% 50%, rgba(255, 150, 62, 0.14) 0%, rgba(255, 118, 38, 0.07) 42%, transparent 72%)',
          }}
        />
        <TravelVanGlyph className="pointer-events-none absolute inset-0 z-[1] block h-full w-full" />
        <span
          className="pointer-events-none absolute left-[48%] top-[52%] z-[2] -translate-x-1/2 -translate-y-1/2 text-[8px] font-semibold tabular-nums tracking-[0.07em] uppercase whitespace-nowrap"
          style={{
            color: TRAVEL_CHIP_MINUTES_COLOR,
            textShadow:
              '0 1px 2px rgba(0,0,0,0.85), 0 0 8px rgba(245, 165, 36, 0.35)',
          }}
        >
          {labelMins} MIN
        </span>
      </div>
    </div>
  );
}

function travelMinsInvalid(tm) {
  return !tm || tm < 8;
}

/**
 * Π-route: vertical trunk in the inter-job gap, **not** through the van (split + gap).
 * Hole height is capped so **minimum shaft** (`ROUTE_TRUNK_SPINE_MIN_PCT`) remains above/below
 * the van when possible. If the span is still too tight, **no trunk** — only diagonal arms + van.
 * Tilt is around the **spine** (right): **earlier** job edge (`yLo`) kicks **down** toward that
 * card; **later** job edge (`yHi`) kicks **up** toward the next card.
 */
function TravelRouteOrthoLayer({ connectors }) {
  if (!connectors.length) return null;

  const spineFromRight = `calc(${100 - ROUTE_GUTTER_X_PCT}% + ${ROUTE_SPINE_ENDPT_NUDGE_PX}px)`;
  const cardEdge = `calc(100% - 0.5rem - ${HUD_APPOINTMENT_CARD_RIGHT_INSET})`;
  const half = ROUTE_TRUNK_STROKE_PX / 2;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[2] overflow-visible"
      aria-hidden
    >
      {connectors.flatMap((c) => {
        const yLo = Math.min(c.y0, c.y1);
        const yHi = Math.max(c.y0, c.y1);
        const span = Math.max(yHi - yLo, 0.05);
        const midY = c.topPct;
        const spinePad = ROUTE_TRUNK_SPINE_MIN_PCT;

        const spineSeg = (suffix, topPct, heightPct) => (
          <div
            key={`${c.key}-spine-${suffix}`}
            aria-hidden
            className="pointer-events-none absolute z-[2] sched-route-spine-plasma"
            style={{
              left: `calc(${ROUTE_GUTTER_X_PCT}% - ${half}px - ${ROUTE_SPINE_ENDPT_NUDGE_PX}px)`,
              width: ROUTE_TRUNK_STROKE_PX,
              top: `${topPct}%`,
              height: `${Math.max(heightPct, 0.03)}%`,
              transform: `translateY(${ROUTE_ROUTE_VERT_NUDGE_PX}px)`,
            }}
          />
        );

        // Van cutout: prefer large hole, but cap by span − 2×shaft so short gaps keep vertical Π-legs.
        // `topPct` is the gap midpoint ⇒ upH = lowH = span/2 − holeH/2 when the hole is centered.
        const maxHoleForShafts = Math.max(0, span - 2 * spinePad);
        let holeH = Math.max(span * ROUTE_TRUNK_VAN_CLEAR_FRAC, ROUTE_TRUNK_VAN_GAP_MIN_PCT);
        holeH = Math.min(holeH, maxHoleForShafts);

        let spineParts = [];
        const gapTop = midY - holeH / 2;
        const gapBot = midY + holeH / 2;
        const upH = gapTop - yLo;
        const lowH = yHi - gapBot;
        if (
          holeH >= ROUTE_TRUNK_VAN_HOLE_HIDE_BELOW_PCT &&
          maxHoleForShafts >= ROUTE_TRUNK_VAN_HOLE_HIDE_BELOW_PCT &&
          upH >= spinePad - 0.0001 &&
          lowH >= spinePad - 0.0001
        ) {
          spineParts = [spineSeg('u', yLo, upH), spineSeg('l', gapBot, lowH)];
        }

        /** `tiltDeg`: origin at spine — positive ° drops the card-side end; negative raises it. */
        const arm = (y, suf, tiltDeg) => (
          <div
            key={`${c.key}-arm-${suf}`}
            aria-hidden
            className="pointer-events-none absolute z-[2] overflow-visible sched-route-arm-plasma"
            style={{
              top: `${y}%`,
              left: cardEdge,
              right: spineFromRight,
              height: ROUTE_TRUNK_STROKE_PX,
              transformOrigin: 'right center',
              transform: `translateY(calc(-50% + ${ROUTE_ROUTE_VERT_NUDGE_PX}px)) rotate(${tiltDeg}deg)`,
            }}
          />
        );

        return [...spineParts, arm(yLo, 't', ROUTE_ARM_TILT_DEG), arm(yHi, 'b', -ROUTE_ARM_TILT_DEG)];
      })}
    </div>
  );
}

function TimelineHudHeader({
  title,
  onToday,
  onNavigatePrevious,
  onNavigateNext,
  hudDateISO,
  onHudDateChange,
}) {
  const todaySweepBtnRef = useRef(null);
  const todaySweepTimersRef = useRef({ raf: undefined, fallback: undefined });
  /** Avoid double sweep when pointer gesture already triggered before click */
  const todaySweepAlreadyFromPointerRef = useRef(false);

  const clearTodaySweepTimers = useCallback(() => {
    const t = todaySweepTimersRef.current;
    if (t.raf != null) {
      cancelAnimationFrame(t.raf);
      t.raf = undefined;
    }
    if (t.fallback != null) {
      window.clearTimeout(t.fallback);
      t.fallback = undefined;
    }
  }, []);

  const triggerTodaySweepPlayback = useCallback(() => {
    const el = todaySweepBtnRef.current;
    if (!el) return;
    clearTodaySweepTimers();
    el.classList.remove('sched-hud-today-sweep-playing');
    const t = todaySweepTimersRef.current;
    t.raf = window.requestAnimationFrame(() => {
      t.raf = undefined;
      void el.offsetWidth;
      el.classList.add('sched-hud-today-sweep-playing');
      t.fallback = window.setTimeout(() => {
        el.classList.remove('sched-hud-today-sweep-playing');
        t.fallback = undefined;
      }, SCHED_HUD_TODAY_SWEEP_MS + 100);
    });
  }, [clearTodaySweepTimers]);

  useEffect(
    () => () => {
      clearTodaySweepTimers();
      todaySweepBtnRef.current?.classList.remove('sched-hud-today-sweep-playing');
    },
    [clearTodaySweepTimers],
  );

  /** Bare hit targets + Neon Lab–style hover (see pages/icon-test — layered glow) */
  const hitTargetBare = 'min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0';
  const neonHover = 'sched-hud-neon-hover';
  const glowWrapCyan = 'inline-flex sched-hud-neon-glow-layer sched-hud-neon-glow-cyan';
  const showPickers =
    typeof hudDateISO === 'string' && typeof onHudDateChange === 'function';
  const showArrows =
    typeof onNavigatePrevious === 'function' && typeof onNavigateNext === 'function';

  return (
    <div
      className="relative z-[5] flex items-stretch min-h-[44px]"
      style={{ borderBottom: '1px solid rgba(34,211,238,0.14)' }}
    >
      <div
        className={`${SCHED_TIMELINE_TIME_AXIS_COLUMN} flex items-center justify-center relative scheduling-time-axis`}
        style={{
          background: 'linear-gradient(180deg, rgba(4,11,24,0.52), rgba(3,9,18,0.62))',
          boxShadow:
            'inset -1px 0 0 rgba(34,211,238,0.14), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {showPickers ? (
          <label
            className={`${hitTargetBare} ${neonHover} cursor-pointer relative overflow-visible`}
          >
            <input
              type="date"
              value={hudDateISO}
              onChange={onHudDateChange}
              aria-label="Select date"
              className="absolute inset-0 z-[6] opacity-0 w-full h-full cursor-pointer"
            />
            <span className={`${glowWrapCyan} pointer-events-none relative z-[1]`}>
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                className="shrink-0"
                aria-hidden
              >
                <rect className="sched-hud-neon-icon-calendar" x="3" y="4" width="18" height="18" rx="2" />
                <line className="sched-hud-neon-icon-calendar" x1="16" y1="2" x2="16" y2="6" />
                <line className="sched-hud-neon-icon-calendar" x1="8" y1="2" x2="8" y2="6" />
                <line className="sched-hud-neon-icon-calendar" x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </span>
          </label>
        ) : (
          <div className={`${hitTargetBare} ${neonHover}`}>
            <span className={glowWrapCyan}>
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                className="shrink-0"
                aria-hidden
              >
                <rect className="sched-hud-neon-icon-calendar" x="3" y="4" width="18" height="18" rx="2" />
                <line className="sched-hud-neon-icon-calendar" x1="16" y1="2" x2="16" y2="6" />
                <line className="sched-hud-neon-icon-calendar" x1="8" y1="2" x2="8" y2="6" />
                <line className="sched-hud-neon-icon-calendar" x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 min-w-0 items-center gap-2 sm:gap-2.5 px-2 py-2 sm:px-3">
        {showArrows ? (
          <button
            type="button"
            onClick={onNavigatePrevious}
            aria-label="Previous day"
            className={`${hitTargetBare} ${neonHover} rounded-lg border-0 bg-transparent shadow-none outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400/25 focus-visible:ring-offset-0 focus-visible:ring-offset-transparent duration-[180ms]`}
          >
            <span className={glowWrapCyan}>
              <HudNavChevron direction="left" />
            </span>
          </button>
        ) : null}
        <span
          className="flex-1 min-w-0 text-center text-[10px] sm:text-[11px] font-semibold truncate leading-snug uppercase -mx-px px-0.5"
          style={{ letterSpacing: '0.12em', color: 'rgba(255,255,255,0.78)' }}
        >
          {title}
        </span>
        {showArrows ? (
          <button
            type="button"
            onClick={onNavigateNext}
            aria-label="Next day"
            className={`${hitTargetBare} ${neonHover} rounded-lg border-0 bg-transparent shadow-none outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400/25 focus-visible:ring-offset-0 focus-visible:ring-offset-transparent duration-[180ms]`}
          >
            <span className={glowWrapCyan}>
              <HudNavChevron direction="right" />
            </span>
          </button>
        ) : null}
        <button
          type="button"
          ref={todaySweepBtnRef}
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            todaySweepAlreadyFromPointerRef.current = true;
            triggerTodaySweepPlayback();
          }}
          onPointerCancel={() => {
            todaySweepAlreadyFromPointerRef.current = false;
          }}
          onPointerLeave={(e) => {
            if (e.buttons === 0) todaySweepAlreadyFromPointerRef.current = false;
          }}
          onClick={(e) => {
            if (!todaySweepAlreadyFromPointerRef.current) triggerTodaySweepPlayback();
            todaySweepAlreadyFromPointerRef.current = false;
            if (typeof onToday === 'function') onToday(e);
          }}
          className="sched-hud-neon-hover sched-hud-today-btn sched-hud-today-glow-sweep relative overflow-hidden shrink-0 flex items-center justify-center ml-auto rounded-md text-[9px] font-bold uppercase tracking-[0.14em] outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-orange-400/40 focus-visible:ring-offset-0"
        >
          <span className="sched-hud-today-label relative z-[1] inline-flex items-center justify-center whitespace-nowrap sched-hud-neon-glow-layer sched-hud-neon-glow-orange">
            Today
          </span>
        </button>
      </div>
    </div>
  );
}

export default function ScheduleTestTimeline({
  appointments = [],
  anchorDate,
  technicianRailMap = {},
  onSelectEvent,
  dayHeaderTitle,
  onNavigateToday,
  onHudNavigatePrevious,
  onHudNavigateNext,
  hudDateISO,
  onHudDateChange,
  blockingStatus,
}) {
  const [nowTick, setNowTick] = useState(() => new Date());
  const scrollAnchorRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNowTick(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const dayStart = useMemo(() => {
    const d = new Date(anchorDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [anchorDate]);

  /** Scales strip height to real minutes (8:40→6pm ≈ 9.33h, slightly shorter than 10h). */
  const timelineMinHeight = (TIMELINE_DAY_TOTAL_MINS / 60) * MIN_PX_PER_HOUR;

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
      const startM = clamp(minsFromMidnight(a._start), TIMELINE_DAY_START_MINS, END_HOUR * 60);
      const endM = clamp(minsFromMidnight(a._end), startM + 15, END_HOUR * 60);
      const topPct = ((startM - TIMELINE_DAY_START_MINS) / TIMELINE_DAY_TOTAL_MINS) * 100;
      const heightPct = Math.max(4, ((endM - startM) / TIMELINE_DAY_TOTAL_MINS) * 100);
      const isBlock = isCalendarBlockEvent(a);
      const blockAccent = isBlock ? CALENDAR_BLOCK_ACCENT[a.block_type] || CALENDAR_BLOCK_ACCENT.other : null;
      const rail = isBlock
        ? blockAccent
        : a.technician_id
          ? technicianRailMap[a.technician_id] || NEON_RAILS[0]
          : '#64748B';
      return { ...a, topPct, heightPct, rail, isBlock, blockAccent };
    });
  }, [appointments, dayStart, technicianRailMap]);

  const connectors = useMemo(() => {
    const out = [];
    for (let i = 0; i < prepared.length - 1; i += 1) {
      const a = prepared[i];
      const b = prepared[i + 1];
      if (isCalendarBlockEvent(a) || isCalendarBlockEvent(b)) continue;
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
    if (m < TIMELINE_DAY_START_MINS || m > END_HOUR * 60) return null;
    return ((m - TIMELINE_DAY_START_MINS) / TIMELINE_DAY_TOTAL_MINS) * 100;
  }, [nowTick, dayStart]);

  /** Scroll so the 9 AM band (see `TIMELINE_SCROLL_ANCHOR_HOUR`) sits near the top. */
  useEffect(() => {
    if (blockingStatus) return;
    const node = scrollAnchorRef.current;
    if (!node) return;
    const id = requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'nearest' });
    });
    return () => cancelAnimationFrame(id);
  }, [anchorDate, blockingStatus, timelineMinHeight]);

  const showScrollAnchor = !blockingStatus;

  const showFusedDayHeader =
    typeof dayHeaderTitle === 'string' && dayHeaderTitle.length > 0 && typeof onNavigateToday === 'function';

  const bodyBlocking = blockingStatus === 'loading' || blockingStatus === 'error';

  return (
    <>
      <style jsx global>{`
        /* Layered neon hover — icon-test Neon Lab pattern; cyan + orange scoped to fused HUD */
        .sched-timeline-hud-root.sched-hud-neon-scope {
          --sched-hud-neon: #22d3ee;
          --sched-hud-neon-bright: #66e6ff;
          --sched-hud-neon-active: #eafbff;
        }
        .sched-hud-neon-scope .sched-hud-neon-glow-layer {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition:
            filter 0.25s ease,
            transform 0.25s ease;
        }
        .sched-hud-neon-scope .sched-hud-neon-glow-cyan {
          filter:
            drop-shadow(0 0 2px rgba(34, 211, 238, 0.85))
            drop-shadow(0 0 6px rgba(34, 211, 238, 0.55))
            drop-shadow(0 0 12px rgba(34, 211, 238, 0.35));
        }
        .sched-hud-neon-scope .sched-hud-neon-glow-orange {
          filter:
            drop-shadow(0 0 2px rgba(255, 138, 26, 0.75))
            drop-shadow(0 0 8px rgba(255, 122, 0, 0.48))
            drop-shadow(0 0 14px rgba(255, 122, 0, 0.3));
        }
        .sched-hud-neon-scope .sched-hud-neon-icon-calendar {
          stroke: var(--sched-hud-neon);
          stroke-width: 1.65;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          transition: stroke 0.25s ease;
        }
        .sched-hud-neon-scope .sched-hud-neon-chevron {
          stroke: var(--sched-hud-neon);
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          transition: stroke 0.25s ease;
        }
        .sched-hud-neon-scope label.sched-hud-neon-hover,
        .sched-hud-neon-scope button.sched-hud-neon-hover {
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .sched-hud-neon-scope .sched-hud-neon-hover {
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .sched-hud-neon-scope .sched-hud-neon-hover:hover .sched-hud-neon-icon-calendar,
        .sched-hud-neon-scope .sched-hud-neon-hover:hover .sched-hud-neon-chevron {
          stroke: var(--sched-hud-neon-bright);
        }
        .sched-hud-neon-scope .sched-hud-neon-hover:hover {
          transform: scale(1.08);
        }
        .sched-hud-neon-scope .sched-hud-neon-hover:hover .sched-hud-neon-glow-layer.sched-hud-neon-glow-cyan {
          filter:
            drop-shadow(0 0 3px rgba(34, 211, 238, 1))
            drop-shadow(0 0 12px rgba(34, 211, 238, 0.9))
            drop-shadow(0 0 24px rgba(34, 211, 238, 0.55));
        }
        .sched-hud-today-btn.sched-hud-neon-hover:hover .sched-hud-neon-glow-layer.sched-hud-neon-glow-orange {
          filter:
            drop-shadow(0 0 3px rgba(255, 218, 180, 0.98))
            drop-shadow(0 0 12px rgba(255, 138, 26, 0.92))
            drop-shadow(0 0 26px rgba(255, 122, 0, 0.58));
        }
        .sched-hud-today-btn {
          padding: 0.3rem 0.5rem;
          border: 1px solid rgba(255, 138, 26, 0.38);
          background: linear-gradient(180deg, rgba(255, 122, 0, 0.14), rgba(255, 122, 0, 0.05));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            0 0 16px rgba(255, 138, 26, 0.18);
          transition:
            transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
            border-color 0.25s ease,
            box-shadow 0.25s ease,
            background 0.25s ease;
        }
        .sched-hud-today-btn .sched-hud-today-label {
          color: #ffb86c;
          transition: color 0.25s ease;
        }
        .sched-hud-today-btn.sched-hud-neon-hover:hover {
          transform: scale(1.08);
          border-color: rgba(255, 178, 110, 0.58);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.12),
            0 0 22px rgba(255, 138, 26, 0.38),
            0 0 12px rgba(255, 122, 0, 0.28),
            0 0 28px rgba(255, 100, 0, 0.15);
          background: linear-gradient(180deg, rgba(255, 160, 60, 0.24), rgba(255, 122, 0, 0.1));
        }
        /* Elite glow sweep: class sched-hud-today-sweep-playing (JS); runs ~0.8s through release — keep SCHED_HUD_TODAY_SWEEP_MS in sync */
        .sched-hud-today-btn.sched-hud-today-glow-sweep::after {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 0;
          border-radius: inherit;
          background: linear-gradient(
            120deg,
            transparent 0%,
            rgba(255, 218, 180, 0.38) 42%,
            rgba(255, 150, 60, 0.55) 50%,
            rgba(255, 200, 140, 0.32) 58%,
            transparent 100%
          );
          opacity: 0;
          transform: translateX(-100%);
          transition: opacity 0.3s ease;
          pointer-events: none;
        }
        .sched-hud-today-btn.sched-hud-today-glow-sweep.sched-hud-today-sweep-playing::after {
          opacity: 1;
          animation: sched-hud-today-sweep-move 0.8s ease-out;
        }
        @keyframes sched-hud-today-sweep-move {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(100%);
          }
        }
        .sched-hud-today-btn.sched-hud-neon-hover:hover .sched-hud-today-label {
          color: #ffe8d4;
        }
        /* Travel route — orange plasma on the nodes only (no ::before/::after: avoids WebKit mis-paint) */
        .sched-hud-neon-scope .sched-route-arm-plasma {
          border-radius: 9999px;
          background: linear-gradient(
            90deg,
            rgba(255, 100, 20, 0.1) 0%,
            rgba(255, 160, 70, 0.32) 14%,
            rgba(255, 138, 26, 0.82) 36%,
            rgba(255, 200, 130, 0.48) 52%,
            rgba(255, 122, 0, 0.85) 68%,
            rgba(255, 178, 100, 0.28) 88%,
            rgba(255, 90, 0, 0.08) 100%
          );
          background-size: 280% 100%;
          background-position: 12% 50%;
          box-shadow:
            0 0 4px rgba(255, 200, 140, 0.55),
            0 0 14px rgba(255, 130, 40, 0.22),
            0 0 22px rgba(255, 100, 20, 0.08),
            inset 0 0 4px rgba(255, 255, 255, 0.15);
          animation: sched-route-orange-plasma-drift 5.8s ease-in-out infinite;
        }
        .sched-hud-neon-scope .sched-route-spine-plasma {
          border-radius: 9999px;
          background: linear-gradient(
            180deg,
            rgba(255, 120, 40, 0.42) 0%,
            rgba(255, 90, 0, 0.28) 32%,
            rgba(255, 170, 85, 0.62) 50%,
            rgba(255, 122, 0, 0.32) 68%,
            rgba(255, 200, 130, 0.38) 100%
          );
          background-size: 100% 240%;
          background-position: 50% 20%;
          box-shadow:
            0 0 4px rgba(255, 190, 120, 0.48),
            0 0 12px rgba(255, 120, 30, 0.2),
            inset 0 0 3px rgba(255, 255, 255, 0.12);
          animation: sched-route-orange-spine-drift 6.2s ease-in-out infinite;
        }
        @keyframes sched-route-orange-plasma-drift {
          0%,
          100% {
            background-position: 5% 50%;
            opacity: 0.94;
          }
          50% {
            background-position: 95% 50%;
            opacity: 1;
          }
        }
        @keyframes sched-route-orange-spine-drift {
          0%,
          100% {
            background-position: 50% 5%;
            opacity: 0.93;
          }
          50% {
            background-position: 50% 95%;
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .sched-hud-neon-scope .sched-route-arm-plasma,
          .sched-hud-neon-scope .sched-route-spine-plasma {
            animation: none !important;
          }
          .sched-hud-neon-scope .sched-route-arm-plasma {
            background-position: 45% 50%;
            opacity: 0.98;
          }
          .sched-hud-neon-scope .sched-route-spine-plasma {
            background-position: 50% 40%;
            opacity: 0.96;
          }
        }
        /* Tap / press — cyan controls spike; Today uses tidy press below */
        .sched-hud-neon-scope label.sched-hud-neon-hover:active,
        .sched-hud-neon-scope button.sched-hud-neon-hover:not(.sched-hud-today-btn):active {
          transform: scale(1.12);
        }
        .sched-hud-neon-scope .sched-hud-neon-hover:active .sched-hud-neon-icon-calendar,
        .sched-hud-neon-scope .sched-hud-neon-hover:active .sched-hud-neon-chevron {
          stroke: var(--sched-hud-neon-active);
        }
        .sched-hud-neon-scope .sched-hud-neon-hover:active .sched-hud-neon-glow-layer.sched-hud-neon-glow-cyan {
          filter:
            drop-shadow(0 0 4px rgba(255, 255, 255, 0.98))
            drop-shadow(0 0 14px rgba(34, 211, 238, 1))
            drop-shadow(0 0 28px rgba(34, 211, 238, 0.98))
            drop-shadow(0 0 42px rgba(34, 211, 238, 0.7));
        }
        .sched-hud-today-btn.sched-hud-neon-hover:active {
          transform: scale(1.04);
          border-color: rgba(255, 190, 140, 0.65);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.12),
            0 0 20px rgba(255, 160, 70, 0.35),
            0 0 10px rgba(255, 122, 0, 0.22);
        }
        .sched-hud-today-btn.sched-hud-neon-hover:active .sched-hud-today-label {
          color: #fff8f0;
        }
        .sched-hud-today-btn.sched-hud-neon-hover:active .sched-hud-neon-glow-layer.sched-hud-neon-glow-orange {
          filter:
            drop-shadow(0 0 4px rgba(255, 220, 190, 0.9))
            drop-shadow(0 0 12px rgba(255, 150, 60, 0.75))
            drop-shadow(0 0 22px rgba(255, 122, 0, 0.45));
        }
      `}</style>
      <div
        className={`relative isolate overflow-hidden sched-timeline-hud-root sched-hud-neon-scope ${HUD_SHELL_RADIUS_CLASS}`}
        style={hudShellChrome}
      >
      {showFusedDayHeader ? (
        <TimelineHudHeader
          title={dayHeaderTitle}
          onToday={onNavigateToday}
          onNavigatePrevious={onHudNavigatePrevious}
          onNavigateNext={onHudNavigateNext}
          hudDateISO={hudDateISO}
          onHudDateChange={onHudDateChange}
        />
      ) : null}

      <div className="relative" style={{ minHeight: timelineMinHeight }}>
        {blockingStatus === 'loading' && (
          <div
            className="flex justify-center items-center py-20 relative z-10 px-6"
            style={{ minHeight: timelineMinHeight }}
          >
            <LoadingSpinner />
          </div>
        )}

        {blockingStatus === 'error' && (
          <div
            className="flex justify-center items-center py-16 relative z-10 px-6 text-center text-sm"
            style={{ minHeight: timelineMinHeight, color: 'rgba(255,255,255,0.45)' }}
          >
            Unable to load schedule.
          </div>
        )}

        {!bodyBlocking && (
          <>
            <TimelineGridScene />

            <div className="relative flex z-[2] rounded-[inherit]">
        {showScrollAnchor && (
          <div
            ref={scrollAnchorRef}
            className="pointer-events-none absolute left-0 right-0 z-[30] h-0 scroll-mt-3"
            style={{ top: `${SCHEDULE_SCROLL_ANCHOR_PCT}%` }}
            aria-hidden
          />
        )}
        {/* Time axis */}
        <div
          className={`${SCHED_TIMELINE_TIME_AXIS_COLUMN} relative z-[4] scheduling-time-axis`}
          style={{
            minHeight: timelineMinHeight,
            background: 'linear-gradient(180deg, rgba(4,11,24,0.42), rgba(2,7,14,0.58))',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow:
              'inset -1px 0 0 rgba(34,211,238,0.14), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/*
            In-flow strut: track + axis only use absolutely positioned children for labels/cards/route.
            Without this, % top/height can resolve against an indefinite/collapsed column (esp. mobile).
          */}
          <div
            aria-hidden
            className="pointer-events-none w-full overflow-hidden select-none"
            style={{ height: timelineMinHeight }}
          />
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => {
            const h = START_HOUR + 1 + i;
            const rawPct = ((h * 60 - TIMELINE_DAY_START_MINS) / TIMELINE_DAY_TOTAL_MINS) * 100;
            const topPct = Math.max(0, Math.min(100, rawPct));
            const isLast = h === END_HOUR;
            const labelTransform = isLast ? 'translateY(-100%)' : 'translateY(-50%)';
            return (
              <div
                key={h}
                className="absolute left-0 right-0 w-full tabular-nums text-right leading-none font-medium scheduling-time-label"
                style={{
                  top: `${topPct}%`,
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
          <div
            aria-hidden
            className="pointer-events-none w-full overflow-hidden select-none"
            style={{ height: timelineMinHeight }}
          />
          <TravelRouteOrthoLayer connectors={visibleRouteConnectors} />

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
            if (apt.isBlock) {
              const typeLabel = calendarBlockTypeLabel(apt.block_type);
              const headline = (apt.title || typeLabel).trim();
              return (
                <motion.button
                  key={apt.id ?? `block-${apt.start}-${idx}`}
                  type="button"
                  className="sched-hud-apt absolute left-3 text-left rounded-[12px] overflow-hidden z-[5] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25 group"
                  style={{
                    top: `${apt.topPct}%`,
                    height: `${apt.heightPct}%`,
                    minHeight: Math.max(52, Math.round(MIN_PX_PER_HOUR * 0.55)),
                    right: `calc(0.5rem + ${HUD_APPOINTMENT_CARD_RIGHT_INSET})`,
                  }}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16, delay: Math.min(idx * 0.03, 0.18), ease: HUD_EASE }}
                  onClick={() => onSelectEvent?.(apt)}
                >
                  <div
                    className="relative flex h-full w-full rounded-[11px] px-2.5 py-2 gap-2 items-center border border-dashed"
                    style={{
                      background: `linear-gradient(180deg, ${apt.blockAccent}18, rgba(8,12,22,0.92))`,
                      borderColor: `${apt.blockAccent}55`,
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 12px ${apt.blockAccent}22`,
                    }}
                  >
                    <div
                      className="w-1 self-stretch rounded-full shrink-0"
                      style={{ background: apt.blockAccent, boxShadow: `0 0 10px ${apt.blockAccent}` }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] truncate" style={{ color: apt.blockAccent }}>
                        {typeLabel}
                      </p>
                      <p className="text-[12px] font-semibold truncate text-white/90">{headline}</p>
                      <p className="text-[10px] text-white/50">
                        {format(apt._start, 'h:mm a')}
                        {apt._end ? ` – ${format(apt._end, 'h:mm a')}` : ''}
                      </p>
                    </div>
                  </div>
                </motion.button>
              );
            }

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
                No jobs or blocks in this window — adjust date or filters.
              </p>
            </div>
          )}
        </div>
      </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}
