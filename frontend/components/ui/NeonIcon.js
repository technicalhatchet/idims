import React from 'react';

/**
 * Default chroma per glyph — matches ApplianceIcon / icon-test appliance set.
 * Cyan: cold/clean appliances; orange: heat / display / laundry dry.
 */
export const NEON_ICON_DEFAULT_COLOR = {
  refrigerator: 'cyan',
  washer: 'cyan',
  dryer: 'orange',
  oven: 'orange',
  dishwasher: 'cyan',
  microwave: 'orange',
  freezer: 'cyan',
  aiolaundry: 'cyan',
  tv: 'orange',
  wrench: 'cyan',
};

/**
 * SVG paths from icon-test (1.5 stroke / icon-neon-thin).
 * Shared by book-test and other public booking flows.
 */
export const NEON_ICON_GLYPHS = {
  refrigerator: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <line x1="6" y1="10" x2="18" y2="10" />
      <line x1="10" y1="5" x2="10" y2="8" />
      <line x1="10" y1="13" x2="10" y2="16" />
    </>
  ),
  washer: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <circle cx="12" cy="13" r="5" />
      <circle cx="12" cy="13" r="2" />
      <circle cx="8" cy="6" r="1" />
    </>
  ),
  dryer: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <circle cx="12" cy="13" r="5" />
      <path d="M10 11a2 2 0 0 0 4 0" />
      <circle cx="8" cy="6" r="1" />
    </>
  ),
  oven: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <rect x="6" y="10" width="12" height="9" rx="1" />
      <line x1="7" y1="6" x2="7" y2="6" />
      <line x1="10" y1="6" x2="10" y2="6" />
      <line x1="13" y1="6" x2="13" y2="6" />
      <line x1="16" y1="6" x2="16" y2="6" />
    </>
  ),
  dishwasher: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="4" y1="8" x2="20" y2="8" />
      <line x1="9" y1="5" x2="15" y2="5" />
    </>
  ),
  microwave: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <rect x="4" y="8" width="12" height="8" />
      <line x1="18" y1="10" x2="18" y2="10" />
      <line x1="18" y1="12" x2="18" y2="12" />
      <line x1="18" y1="14" x2="18" y2="14" />
    </>
  ),
  freezer: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="12" y1="6" x2="12" y2="10" />
    </>
  ),
  aiolaundry: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="4" y1="7" x2="20" y2="7" />
      <rect x="6" y="4" width="3" height="2" rx="0.5" />
      <circle cx="16" cy="5" r="1" />
      <circle cx="12" cy="14" r="5" />
      <circle cx="12" cy="14" r="2" />
    </>
  ),
  tv: (
    <>
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="18" x2="12" y2="21" />
    </>
  ),
  wrench: (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  ),
  powerOff: (
    <>
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </>
  ),
  thermometer: (
    <>
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
      <line x1="10" y1="9" x2="10" y2="5" />
      <line x1="10" y1="13" x2="10" y2="11" />
    </>
  ),
  droplet: <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />,
  volume: (
    <>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </>
  ),
  zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </>
  ),
  calendarDot: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  calendarWeek: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <line x1="8" y1="14" x2="8" y2="18" />
      <line x1="12" y1="14" x2="12" y2="18" />
      <line x1="16" y1="14" x2="16" y2="18" />
    </>
  ),
  hourglass: (
    <>
      <path d="M6 2h12v4l-4 4 4 4v4H6v-4l4-4-4-4V2z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
      <polyline points="9 12 11 14 15 10" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="8" r="6" />
      <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" />
    </>
  ),
};

const VARIANT_STYLES = {
  cyan: {
    stroke: '#00D4FF',
    filter: 'drop-shadow(0 0 6px rgba(0, 212, 255, 0.6))',
  },
  orange: {
    stroke: '#FF7A00',
    filter: 'drop-shadow(0 0 6px rgba(255, 122, 0, 0.6))',
  },
  muted: {
    stroke: '#9CA3AF',
    filter: 'none',
  },
};

/**
 * Thin neon stroke icon (1.5px) — matches icon-test `icon-neon-thin`.
 */
export default function NeonIcon({
  name,
  className = 'w-6 h-6',
  variant = 'cyan',
  strokeWidth = 1.5,
  ...rest
}) {
  const glyph = NEON_ICON_GLYPHS[name];
  if (!glyph) return null;

  const { stroke, filter } = VARIANT_STYLES[variant] || VARIANT_STYLES.cyan;

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      style={{
        stroke,
        strokeWidth,
        fill: 'none',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        filter,
      }}
      {...rest}
    >
      {glyph}
    </svg>
  );
}
