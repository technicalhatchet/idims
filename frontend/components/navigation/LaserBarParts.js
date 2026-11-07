import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Shared pieces for the "laser" bottom bars (work order bar + Techboard dock):
 * the curved fin background, icons, the lifted glowing primary tile and icon tiles.
 * Matches the Laser Slice rail's look.
 */

/**
 * Bar height. The buttons sit 30px down and are 44px tall; below them we only add
 * what keeps them clear of the home indicator (safe area minus 8px, min 8px) instead of
 * stacking the full safe area under the bar.
 */
export const LASER_BAR_HEIGHT_CSS = 'calc(74px + max(8px, env(safe-area-inset-bottom, 0px) - 8px))';
export const LASER_BAR_BUTTON_TOP = 30;
/** Bottom padding for scrolling content so nothing hides behind the bar. */
export const LASER_BAR_SCROLL_PAD_CSS = 'calc(86px + max(8px, env(safe-area-inset-bottom, 0px) - 8px))';

// One combined path per icon so they render from a single <path d>.
const ICON_PATHS = {
  back: 'M19 12H5M12 19l-7-7 7-7',
  plus: 'M12 5v14M5 12h14',
  route: 'M3 11 22 2 13 21 11 13 3 11z',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  card: 'M2 6h20v12H2zM2 10h20M6 15h4',
  cash: 'M2 6h20v12H2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 12h.01M18 12h.01',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 8v8M11 8v8M13.5 8v8M16 8v8',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.35-4.35',
  flag: 'M4 22V4M4 4h13l-2 4 2 4H4',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  calendar: 'M3 5h18v16H3zM16 3v4M8 3v4M3 10h18',
  call: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
  text: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  photo: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  wrench: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  alert: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  queue: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  sort: 'M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4',
  note: 'M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5zM15 3v6h6M7 13h10M7 17h6',
};

export function LaserIcon({ name, size = 18, strokeWidth = 1.9 }) {
  const d = ICON_PATHS[name] || ICON_PATHS.plus;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: '0 0 auto' }}
    >
      <path d={d} />
    </svg>
  );
}

const TONES = {
  cyan: {
    fg: '#03161C',
    bg: 'linear-gradient(180deg, #CFFAFE 0%, #5EEAF8 20%, #22D3EE 55%, #0891B2 100%)',
    ring: 'rgba(165, 243, 252, 0.6)',
    glow: 'rgba(34, 211, 238, 0.45)',
    shade: 'rgba(3, 40, 56, 0.45)',
    seam: '#22D3EE',
  },
  orange: {
    fg: '#1A0A00',
    bg: 'linear-gradient(180deg, #FFE2C2 0%, #FFB46B 22%, #FF8A1F 58%, #C2410C 100%)',
    ring: 'rgba(255, 200, 150, 0.6)',
    glow: 'rgba(255, 138, 31, 0.5)',
    shade: 'rgba(80, 20, 0, 0.4)',
    seam: '#FF8A1F',
  },
  red: {
    fg: '#1F0505',
    bg: 'linear-gradient(180deg, #FECACA 0%, #F87171 24%, #EF4444 58%, #B91C1C 100%)',
    ring: 'rgba(254, 202, 202, 0.75)',
    glow: 'rgba(239, 68, 68, 0.7)',
    shade: 'rgba(80, 5, 5, 0.45)',
    seam: '#EF4444',
  },
};

/** Same number of shadows in every state so the browser can animate between them. */
export function laserTileStyle(tone, { pressed = false } = {}) {
  if (tone === 'off' || !TONES[tone]) {
    return {
      color: '#5B6B80',
      background: 'rgba(13, 22, 38, 0.9)',
      border: '1px dashed #22344D',
      transform: 'translateY(0)',
      boxShadow:
        '0 0 0 0 rgba(0,0,0,0), 0 0 0 0 rgba(0,0,0,0), 0 0 0 0 rgba(0,0,0,0), 0 0 0 0 rgba(0,0,0,0), inset 0 0 0 rgba(0,0,0,0), inset 0 0 0 rgba(0,0,0,0)',
    };
  }
  const t = TONES[tone];
  const warn = tone === 'red';
  return {
    color: t.fg,
    background: t.bg,
    border: '1px solid rgba(255, 255, 255, 0.5)',
    transform: `translateY(${pressed ? -3 : 0}px)`,
    boxShadow: [
      '0 0 0 3px rgba(8, 16, 28, 0.92)',
      `0 0 0 4.5px ${t.ring}`,
      `0 ${pressed ? 10 : 6}px 12px -4px rgba(0, 0, 0, 0.7)`,
      `0 0 ${pressed ? 26 : warn ? 22 : 14}px ${pressed || warn ? 3 : 0}px ${t.glow}`,
      'inset 0 1px 0 rgba(255, 255, 255, 0.85)',
      `inset 0 -3px 5px ${t.shade}`,
    ].join(', '),
  };
}

export const LASER_IDLE_TILE = {
  cyan: {
    color: '#8FE6F3',
    background: 'linear-gradient(180deg, rgba(14, 34, 50, 0.92) 0%, rgba(10, 18, 30, 0.92) 100%)',
    border: '1px solid rgba(34, 211, 238, 0.45)',
  },
  orange: {
    color: '#FFB46B',
    background: 'linear-gradient(180deg, rgba(40, 22, 12, 0.92) 0%, rgba(20, 13, 12, 0.92) 100%)',
    border: '1px solid rgba(255, 138, 31, 0.55)',
  },
};

export function laserSeamColor(tone) {
  return TONES[tone]?.seam || '#22D3EE';
}

/**
 * Keyframes + classes shared by the laser bars. Render once per bar.
 */
export function LaserBarStyles() {
  return (
    <style>{`
      @keyframes lb-seam { 0% { left: -6px; opacity: 1 } 80% { opacity: 1 } 100% { left: calc(100% + 2px); opacity: 0 } }
      @keyframes lb-pop { 0% { opacity: 0; translate: 0 8px; scale: 0.92 } 100% { opacity: 1; translate: 0 0; scale: 1 } }
      @keyframes lb-tag { 0% { opacity: 0; translate: 0 6px } 100% { opacity: 1; translate: 0 0 } }
      @keyframes lb-flicker { 0%, 92%, 96%, 100% { opacity: 1 } 94% { opacity: 0.4 } }
      @keyframes lb-laser-cut { 0% { transform: scaleX(0); opacity: 1 } 55% { transform: scaleX(1); opacity: 1 } 100% { transform: scaleX(1); opacity: 0 } }
      @keyframes lb-spark { 0% { left: -6px; opacity: 1 } 55% { left: calc(100% - 6px); opacity: 1 } 70%, 100% { left: calc(100% - 6px); opacity: 0 } }
      @keyframes lb-panel-in {
        0% { transform: perspective(600px) rotateX(88deg); opacity: 0 }
        12% { opacity: 1 }
        70% { transform: perspective(600px) rotateX(-6deg) }
        100% { transform: perspective(600px) rotateX(0deg); opacity: 1 }
      }
      @keyframes lb-btn-in { 0% { opacity: 0; translate: 0 14px; scale: 0.85 } 100% { opacity: 1; translate: 0 0; scale: 1 } }
      @keyframes lb-scan-x { 0% { transform: translateX(-60px); opacity: 0 } 15% { opacity: 1 } 100% { transform: translateX(110vw); opacity: 0 } }
      .lb-seam { animation: lb-seam 0.34s cubic-bezier(0.5, 0, 0.3, 1) both; }
      .lb-pop { animation: lb-pop 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.2) both; }
      .lb-tag { animation: lb-tag 0.22s ease-out both; }
      .lb-edge { animation: lb-flicker 3.2s linear 1s infinite; }
      .lb-boot .lb-laser { transform-origin: 0 50%; animation: lb-laser-cut 0.42s cubic-bezier(0.6, 0, 0.3, 1) both; }
      .lb-boot .lb-spark { animation: lb-spark 0.42s cubic-bezier(0.6, 0, 0.3, 1) both; }
      .lb-boot .lb-panel { transform-origin: 50% 100%; animation: lb-panel-in 0.55s cubic-bezier(0.2, 0.9, 0.25, 1) 0.2s both; }
      .lb-boot .lb-btn-in { animation: lb-btn-in 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.2) both; }
      .lb-boot .lb-scan { animation: lb-scan-x 0.7s ease-out 0.6s both; }
      .lb-laser, .lb-spark, .lb-scan { opacity: 0; }
      .lb-tile:active { filter: brightness(1.08); }
      .lb-tile:focus-visible { outline: 2px solid #A5F3FC; outline-offset: 3px; }
      .lb-slice:focus-visible { outline: 2px solid #A5F3FC; outline-offset: -5px; border-radius: 10px; }
      .lb-slice:active .lb-slice-c { filter: brightness(1.12); }
      @media (prefers-reduced-motion: reduce) {
        .lb-root *, .lb-root *::before, .lb-root *::after {
          animation-duration: 1ms !important;
          animation-delay: 0ms !important;
          transition-duration: 1ms !important;
        }
      }
    `}</style>
  );
}

const FIN = 'M0 98 C12 98 16 22 40 22 Q195 8 350 22 C374 22 378 98 390 98';

/** The curved, glowing bar background. Stretches to any width. */
export function LaserFin({ idPrefix }) {
  const id = (s) => `${idPrefix}-${s}`;
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox="0 0 390 98"
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
    >
      <defs>
        <linearGradient id={id('bg')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(16,48,66)" stopOpacity="0.97" />
          <stop offset="75%" stopColor="rgb(8,16,28)" stopOpacity="0.98" />
        </linearGradient>
        <pattern id={id('lines')} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="1" fill="#22D3EE" fillOpacity="0.07" />
        </pattern>
        <clipPath id={id('clip')}>
          <path d={`${FIN} Z`} />
        </clipPath>
      </defs>
      <path d={`${FIN} Z`} fill={`url(#${id('bg')})`} />
      <g clipPath={`url(#${id('clip')})`}>
        <rect width="390" height="98" fill={`url(#${id('lines')})`} />
      </g>
      <g className="lb-edge">
        <path d={FIN} transform="translate(0 9)" fill="none" stroke="#22D3EE" strokeOpacity="0.3" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d={FIN} fill="none" stroke="#22D3EE" strokeOpacity="0.35" strokeWidth="6" vectorEffect="non-scaling-stroke" style={{ filter: 'blur(4px)' }} />
        <path d={FIN} fill="none" stroke="#E6FFFF" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}

/** Small orange/cyan readout tag that pops above the bar. */
export function LaserTag({ text, tone = 'cyan' }) {
  if (!text) return null;
  return (
    <div
      aria-live="polite"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: `calc(${LASER_BAR_HEIGHT_CSS} + 6px)`,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        key={text}
        className="lb-tag"
        style={{
          maxWidth: 320,
          textAlign: 'center',
          background: tone === 'orange' ? '#FF8A1F' : tone === 'red' ? '#EF4444' : '#22D3EE',
          color: '#06121A',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          lineHeight: '14px',
          padding: '5px 12px 11px',
          clipPath:
            'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(50% + 6px) calc(100% - 6px), 50% 100%, calc(50% - 6px) calc(100% - 6px), 0 calc(100% - 6px))',
        }}
      >
        {text}
      </div>
    </div>
  );
}

/** Show a tag for a moment. */
export function useLaserTag(ms = 1900) {
  const [tag, setTag] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flash = useCallback((text, tone = 'cyan') => {
    clearTimeout(timer.current);
    setTag({ text, tone });
    timer.current = setTimeout(() => setTag(null), ms);
  }, [ms]);
  return [tag, flash];
}

/** Press feedback: lift + laser seam, then run the action. */
export function usePressThenRun(delayMs = 300) {
  const [pressedKey, setPressedKey] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const press = useCallback((key, run) => {
    clearTimeout(timer.current);
    setPressedKey(key);
    timer.current = setTimeout(() => {
      setPressedKey(null);
      run?.();
    }, delayMs);
  }, [delayMs]);
  return [pressedKey, press];
}

export function LaserSeam({ tone }) {
  const c = laserSeamColor(tone);
  return (
    <span
      aria-hidden="true"
      className="lb-seam"
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 3,
        background: '#FFFFFF',
        boxShadow: `0 0 8px #FFFFFF, 0 0 18px ${c}`,
      }}
    />
  );
}
