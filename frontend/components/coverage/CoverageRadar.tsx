import { useId, useMemo } from 'react';
import { motion } from 'framer-motion';

type CoverageRadarProps = {
  city?: string;
  subtitle?: string;
  caption?: string;
  className?: string;
};

/** Shared radar coordinate system — all disc elements anchor here */
const RADAR_CX = 100;
const RADAR_CY = 100;
const RADAR_R = 82;
const OUTER_R = 96;
const TICK_COUNT = 120;
const SWEEP_SPAN_DEG = 48;

/** Leading edge of clockwise sweep: wedge starts at 12 o'clock, arc runs CW — front is the CW tip */
function getSweepLeadingEdge() {
  const leadingAngleDeg = -90 + SWEEP_SPAN_DEG;
  const rad = (leadingAngleDeg * Math.PI) / 180;
  return {
    x: RADAR_R * Math.cos(rad),
    y: RADAR_R * Math.sin(rad),
  };
}

/** Cargo side panel bounds (excludes cab) for logo placement */
const TRUCK_PANEL = { left: -22, right: 14, top: -14, bottom: 6 };
const TRUCK_PANEL_CX = (TRUCK_PANEL.left + TRUCK_PANEL.right) / 2;
const TRUCK_PANEL_CY = (TRUCK_PANEL.top + TRUCK_PANEL.bottom) / 2;
const TRUCK_LOGO_SIZE = 13;

/** Full-width skyline silhouette — viewBox includes negative y for tower peaks */
const SKYLINE_VIEWBOX = { minX: 0, minY: -12, width: 200, height: 84 };
const SKYLINE_PATH =
  'M 0 72 L 0 58 L 10 58 L 10 50 L 18 50 L 18 62 L 26 62 L 26 44'
  + ' L 34 44 L 34 36 L 40 36 L 40 54 L 48 54 L 48 42 L 56 42 L 56 32'
  + ' L 62 32 L 66 22 L 70 32 L 76 32 L 76 48 L 84 48 L 84 14 L 90 14'
  + ' L 90 0 L 96 -8 L 102 0 L 102 14 L 108 14 L 108 40 L 116 40'
  + ' L 116 26 L 124 26 L 128 16 L 132 26 L 140 26 L 140 52 L 148 52'
  + ' L 148 38 L 156 38 L 156 30 L 162 30 L 166 20 L 170 30 L 178 30'
  + ' L 178 56 L 186 56 L 186 46 L 194 46 L 194 60 L 200 60 L 200 72 Z';

function buildTicks() {
  return Array.from({ length: TICK_COUNT }, (_, i) => {
    const angle = (i / TICK_COUNT) * 360 - 90;
    const rad = (angle * Math.PI) / 180;
    const inner = RADAR_R + 4;
    const outer = i % 10 === 0 ? RADAR_R + 12 : RADAR_R + 9;
    return {
      x1: RADAR_CX + inner * Math.cos(rad),
      y1: RADAR_CY + inner * Math.sin(rad),
      x2: RADAR_CX + outer * Math.cos(rad),
      y2: RADAR_CY + outer * Math.sin(rad),
      major: i % 10 === 0,
    };
  });
}

function StreetMapTexture({ clipId }: { clipId: string }) {
  const lines = useMemo(() => {
    const h: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const v: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < 9; i += 1) {
      const t = RADAR_CY - 68 + i * 9;
      h.push({ x1: RADAR_CX - 68, y1: t, x2: RADAR_CX + 68, y2: t + (i % 2) * 2 });
      v.push({ x1: t, y1: RADAR_CY - 68, x2: t + (i % 3), y2: RADAR_CY + 68 });
    }
    return { h, v };
  }, []);

  return (
    <g clipPath={`url(#${clipId})`} opacity={0.22}>
      {lines.h.map((l, i) => (
        <line key={`h-${i}`} {...l} stroke="var(--radar-muted)" strokeWidth="0.6" />
      ))}
      {lines.v.map((l, i) => (
        <line key={`v-${i}`} {...l} stroke="var(--radar-muted)" strokeWidth="0.6" />
      ))}
      <path
        d={`M ${RADAR_CX - 45} ${RADAR_CY - 28} Q ${RADAR_CX - 22} ${RADAR_CY - 32} ${RADAR_CX} ${RADAR_CY - 26} T ${RADAR_CX + 45} ${RADAR_CY - 30} M ${RADAR_CX - 52} ${RADAR_CY + 18} Q ${RADAR_CX - 10} ${RADAR_CY + 12} ${RADAR_CX} ${RADAR_CY + 20} T ${RADAR_CX + 52} ${RADAR_CY + 15}`}
        fill="none"
        stroke="var(--radar-muted)"
        strokeWidth="0.8"
      />
    </g>
  );
}

function ServiceVanMotionLines() {
  return (
    <motion.g
      animate={{ opacity: [0.35, 0.75, 0.35], x: [-2, 0, -2] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
    >
      <line x1="-38" y1="-4" x2="-18" y2="-4" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
      <line x1="-42" y1="0" x2="-16" y2="0" stroke="var(--orange)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="-36" y1="4" x2="-20" y2="4" stroke="var(--orange)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    </motion.g>
  );
}

function ServiceVanBody() {
  const logoX = TRUCK_PANEL_CX - TRUCK_LOGO_SIZE / 2;
  const logoY = TRUCK_PANEL_CY - TRUCK_LOGO_SIZE / 2;

  return (
    <motion.g
      animate={{ y: [0, -1.5, 0] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <rect x="-22" y="-14" width="44" height="22" rx="3" fill="none" stroke="var(--cyan)" strokeWidth="1.4" />
      <path d="M 14 -14 L 22 -8 L 22 8 L 14 8 Z" fill="none" stroke="var(--cyan)" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="-12" cy="10" r="4" fill="none" stroke="var(--cyan)" strokeWidth="1.2" />
      <circle cx="12" cy="10" r="4" fill="none" stroke="var(--cyan)" strokeWidth="1.2" />
      <image
        href="/atomwrenches.png"
        x={logoX}
        y={logoY}
        width={TRUCK_LOGO_SIZE}
        height={TRUCK_LOGO_SIZE}
        preserveAspectRatio="xMidYMid meet"
      />
    </motion.g>
  );
}

function ServiceVan() {
  return (
    <g transform={`translate(${RADAR_CX} ${RADAR_CY})`}>
      <ServiceVanMotionLines />
      <ServiceVanBody />
    </g>
  );
}

/** Pin tip on outer ring at 12 o'clock; label clearly above (reference layout) */
function CoverageMarker() {
  const pinTipY = RADAR_CY - OUTER_R;
  const pinTipLocalY = 11;
  const pinHeadTopLocalY = -9;
  const pinOriginY = pinTipY - pinTipLocalY;
  const pinHeadTopY = pinOriginY + pinHeadTopLocalY;
  const labelGap = 8;
  const labelSize = 7;
  const labelBaselineY = pinHeadTopY - labelGap;

  return (
    <g>
      <g transform={`translate(${RADAR_CX} ${pinOriginY})`}>
        <g>
          <animate
            attributeName="opacity"
            values="0.8;1;0.8"
            dur="2.8s"
            repeatCount="indefinite"
          />
          <path
            d="M 0 -9 C 4.5 -9 8 -5.5 8 -1 C 8 3 0 11 0 11 C 0 11 -8 3 -8 -1 C -8 -5.5 -4.5 -9 0 -9 Z"
            fill="var(--orange)"
            style={{ filter: 'drop-shadow(0 0 8px var(--orange-glow))' }}
          />
          <circle cx="0" cy="-2" r="3.2" fill="#0a1020" stroke="var(--orange)" strokeWidth="0.5" />
        </g>
      </g>
      <text
        x={RADAR_CX}
        y={labelBaselineY}
        textAnchor="middle"
        dominantBaseline="auto"
        fill="var(--cyan)"
        fontSize={labelSize}
        fontFamily="system-ui, sans-serif"
        fontWeight="600"
        letterSpacing="0.12em"
      >
        20 MIN
      </text>
    </g>
  );
}

function ToledoSkylineBand({ fillId }: { fillId: string }) {
  const { minX, minY, width, height } = SKYLINE_VIEWBOX;

  return (
    <motion.svg
      viewBox={`${minX} ${minY} ${width} ${height}`}
      className="w-full h-full block"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden
      animate={{ opacity: [0.65, 0.95, 0.65] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
    >
      <defs>
        <linearGradient id={fillId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      <path
        d={`M 0 72 Q 50 69 100 70.5 T 200 72`}
        fill="none"
        stroke="var(--cyan)"
        strokeWidth="0.8"
        opacity="0.3"
      />

      <path
        d={SKYLINE_PATH}
        fill={`url(#${fillId})`}
        stroke="var(--cyan)"
        strokeWidth="1.2"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ filter: 'drop-shadow(0 0 12px var(--cyan-glow))' }}
      />

      <path
        d="M 99 -6 L 100 -12 L 101 -6"
        fill="none"
        stroke="var(--cyan)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
        opacity="0.9"
      />

      {[
        [24, 54], [52, 46], [100, 28], [148, 44], [176, 52],
        [36, 62], [124, 58], [164, 48],
      ].map(([x, y], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width="2.5"
          height="3"
          rx="0.3"
          fill="var(--cyan)"
          opacity={0.35 + (i % 3) * 0.15}
        />
      ))}
    </motion.svg>
  );
}

function RadarSweepWedge({ clipId, sweepGradId }: { clipId: string; sweepGradId: string }) {
  const { x: sweepEndX, y: sweepEndY } = getSweepLeadingEdge();

  return (
    <g clipPath={`url(#${clipId})`}>
      <g transform={`translate(${RADAR_CX} ${RADAR_CY})`}>
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0"
            to="360"
            dur="8s"
            repeatCount="indefinite"
          />
          <path
            d={`M 0 0 L 0 ${-RADAR_R} A ${RADAR_R} ${RADAR_R} 0 0 1 ${sweepEndX} ${sweepEndY} Z`}
            fill={`url(#${sweepGradId})`}
            opacity="0.5"
          />
        </g>
      </g>
    </g>
  );
}

function RadarSweepLine({ clipId }: { clipId: string }) {
  const { x: leadingX, y: leadingY } = getSweepLeadingEdge();

  return (
    <g clipPath={`url(#${clipId})`}>
      <g transform={`translate(${RADAR_CX} ${RADAR_CY})`}>
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0"
            to="360"
            dur="8s"
            repeatCount="indefinite"
          />
          <line
            x1={0}
            y1={0}
            x2={leadingX}
            y2={leadingY}
            stroke="var(--cyan)"
            strokeWidth="2"
            opacity="1"
            strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 6px var(--cyan-glow))' }}
          />
        </g>
      </g>
    </g>
  );
}

function CardinalCrosshairs() {
  const arm = OUTER_R + 2;
  const notch = OUTER_R - 10;
  const dots = [
    { cx: RADAR_CX, cy: RADAR_CY - arm, x1: RADAR_CX, y1: RADAR_CY - arm, x2: RADAR_CX, y2: RADAR_CY - notch },
    { cx: RADAR_CX, cy: RADAR_CY + arm, x1: RADAR_CX, y1: RADAR_CY + notch, x2: RADAR_CX, y2: RADAR_CY + arm },
    { cx: RADAR_CX - arm, cy: RADAR_CY, x1: RADAR_CX - arm, y1: RADAR_CY, x2: RADAR_CX - notch, y2: RADAR_CY },
    { cx: RADAR_CX + arm, cy: RADAR_CY, x1: RADAR_CX + notch, y1: RADAR_CY, x2: RADAR_CX + arm, y2: RADAR_CY },
  ];

  return (
    <>
      {dots.map((d, i) => {
        if (i === 0) return null;
        return (
          <g key={i}>
            <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke="var(--cyan)" strokeWidth="1.2" opacity="0.7" />
            <circle cx={d.cx} cy={d.cy} r="2.5" fill="var(--cyan)" opacity="0.9" />
          </g>
        );
      })}
    </>
  );
}

export default function CoverageRadar({
  city = 'Toledo, OH',
  subtitle = '20-Minute Standard Service Area',
  caption = 'Drive-time based coverage',
  className = '',
}: CoverageRadarProps) {
  const uid = useId().replace(/:/g, '');
  const clipId = `radar-clip-${uid}`;
  const glowId = `radar-glow-${uid}`;
  const sweepGradId = `sweep-grad-${uid}`;
  const skylineFillId = `skyline-fill-${uid}`;
  const ticks = useMemo(() => buildTicks(), []);

  return (
    <div
      className={`relative w-full max-w-sm mx-auto rounded-2xl border backdrop-blur-xl ${className}`}
      style={{
        ['--cyan' as string]: '#00E5FF',
        ['--orange' as string]: '#FF7A1A',
        ['--cyan-glow' as string]: 'rgba(0, 229, 255, 0.45)',
        ['--orange-glow' as string]: 'rgba(255, 122, 26, 0.55)',
        ['--radar-muted' as string]: '#4a6278',
        background: 'linear-gradient(165deg, rgba(0, 8, 17, 0.92) 0%, rgba(0, 2, 8, 0.88) 100%)',
        borderColor: 'rgba(0, 229, 255, 0.22)',
        boxShadow: '0 0 40px rgba(0, 229, 255, 0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div
        className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none bg-gradient-to-br from-cyan-500/5 via-transparent to-orange-500/5"
      />

      <div className="relative flex flex-col items-center">
        <div className="flex flex-col items-center w-full px-4 pt-5 pb-4 gap-3">
          <div className="w-full max-w-[240px] aspect-square shrink-0">
            <svg viewBox="0 -42 200 242" className="w-full h-full block" aria-hidden>
              <defs>
                <clipPath id={clipId}>
                  <circle cx={RADAR_CX} cy={RADAR_CY} r={RADAR_R} />
                </clipPath>
                <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.12" />
                  <stop offset="70%" stopColor="var(--cyan)" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
                </radialGradient>
                <linearGradient id={sweepGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0" />
                  <stop offset="40%" stopColor="var(--cyan)" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0.55" />
                </linearGradient>
              </defs>

              {/* 1–3: background glow + inner rings + grid */}
              <circle
                cx={RADAR_CX}
                cy={RADAR_CY}
                r={RADAR_R + 6}
                fill={`url(#${glowId})`}
              />
              <circle cx={RADAR_CX} cy={RADAR_CY} r={RADAR_R - 10} fill="none" stroke="var(--cyan)" strokeWidth="0.5" opacity="0.2" />
              <circle cx={RADAR_CX} cy={RADAR_CY} r={RADAR_R - 26} fill="none" stroke="var(--cyan)" strokeWidth="0.4" opacity="0.15" />
              <circle cx={RADAR_CX} cy={RADAR_CY} r={RADAR_R - 42} fill="none" stroke="var(--cyan)" strokeWidth="0.35" opacity="0.12" />
              <StreetMapTexture clipId={clipId} />

              {/* 4: translucent sweep wedge */}
              <RadarSweepWedge clipId={clipId} sweepGradId={sweepGradId} />

              {/* 5–6: truck + motion lines behind body */}
              <ServiceVan />

              {/* 7: bold sweep line — above wedge and truck */}
              <RadarSweepLine clipId={clipId} />

              {/* 8: outer ring + ticks + cardinal marks */}
              <circle
                cx={RADAR_CX}
                cy={RADAR_CY}
                r={OUTER_R}
                fill="none"
                stroke="var(--cyan)"
                strokeWidth="0.6"
                opacity="0.25"
              />
              <circle
                cx={RADAR_CX}
                cy={RADAR_CY}
                r={RADAR_R + 6}
                fill="none"
                stroke="var(--cyan)"
                strokeWidth="1.2"
                style={{ filter: 'drop-shadow(0 0 10px var(--cyan-glow))' }}
              />
              {ticks.map((t, i) => (
                <line
                  key={i}
                  x1={t.x1}
                  y1={t.y1}
                  x2={t.x2}
                  y2={t.y2}
                  stroke="var(--cyan)"
                  strokeWidth={t.major ? 1.1 : 0.55}
                  opacity={t.major ? 0.85 : 0.45}
                />
              ))}
              <CardinalCrosshairs />

              <circle cx={RADAR_CX} cy={RADAR_CY} r="2.5" fill="var(--cyan)" opacity="0.9" />

              {/* 9–10: pin then label */}
              <CoverageMarker />
            </svg>
          </div>

          <div className="w-[90%] max-w-[340px] h-[6rem] shrink-0 mx-auto">
            <ToledoSkylineBand fillId={skylineFillId} />
          </div>
        </div>

        <div className="w-full border-t border-white/5 px-6 pt-5 pb-6 flex flex-col items-center text-center gap-4">
          <div className="flex flex-col items-center gap-1 w-full">
            <h3 className="text-lg font-bold text-white tracking-tight">{city}</h3>
            <p className="text-sm font-semibold" style={{ color: 'var(--cyan)' }}>
              {subtitle}
            </p>
            <p className="text-xs text-gray-500">{caption}</p>
          </div>

          <div className="w-full pt-4 border-t border-white/5 flex items-center justify-center gap-2 text-xs text-gray-500">
            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="var(--cyan)" strokeWidth="1.5">
              <path d="M4 18c4-6 8-8 12-8s8 2 12 8" strokeDasharray="3 3" />
              <circle cx="12" cy="8" r="2.5" fill="var(--orange)" stroke="none" />
            </svg>
            <span>Live coverage from our Toledo dispatch hub</span>
          </div>
        </div>
      </div>
    </div>
  );
}
