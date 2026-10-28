import { useState, useEffect, useLayoutEffect, useCallback, useRef, useId } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useSweepNavigate } from '../../hooks/useSweepNavigate';
import { TECH_ICON_ASPECT, TECH_ICON_PARTS, TECH_ICON_VIEWBOX } from '../../constants/techIconRail';
import { NAV_ITEMS } from './TechIconRail';

/**
 * "Laser Slice" right-side icon rail — an opt-in alternative to TechIconRail.
 * Same props ({ isOpen, onClose }) and same nav items / routes, so TechDashboardLayout
 * can swap between the two based on the `railStyle` UI preference.
 *
 * Open:  laser cuts down the right screen edge → panel unfolds out of that hinge in 3D →
 *        icons power up top-to-bottom with a scan sweep → active bar + tag lock on.
 * Close: panel folds back into the edge and the laser seam seals.
 */

const RAIL_W = 84; // panel width (px)
const EDGE_INSET = 12; // gap below the header / above the home indicator
const END_PAD = 90; // keeps icons clear of the curved top/bottom of the fin
const ICON_BOX = 44;
const DASH_BOX = 56;
const BAR_H = 40;
const DASH_BAR_H = 50;
const CLOSE_MS = 460; // must cover the fold-out + laser-close animations

const CYAN = '#22D3EE';

// useLayoutEffect warns during SSR; fall back to useEffect on the server.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
const ACTIVE_ICON = '#03161C';
const IDLE_ICON = '#7C8BA1';
const IDLE_DASH = '#B4C6D8';

const TAGS = {
  settings: 'CONFIG',
  technicians: 'TECHS',
  clients: 'CLIENTS',
  schedule: 'OPS',
  dashboard: 'DASH',
  route: 'ROUTE',
  workorders: 'ORDERS',
  performance: 'PERF',
  dma: 'DMA',
};

/** The fin: flush with the screen edge at both ends, S-curving out, gently bowed in the middle. */
function finPath(h, dx = 0) {
  const x = (v) => v + dx;
  return (
    `M${x(84)} 0 C${x(84)} 36 ${x(12)} 40 ${x(12)} 88 ` +
    `Q${x(-6)} ${h / 2} ${x(12)} ${h - 88} ` +
    `C${x(12)} ${h - 40} ${x(84)} ${h - 36} ${x(84)} ${h}`
  );
}

function RailIcon({ item, size }) {
  if (item.id === 'technicians') {
    return (
      <svg
        viewBox={TECH_ICON_VIEWBOX}
        width={size + 4}
        height={Math.round(((size + 4) / TECH_ICON_ASPECT) * 100) / 100}
        aria-hidden="true"
        style={{ fill: 'currentColor', stroke: 'none' }}
      >
        {TECH_ICON_PARTS.map(({ d, fillRule, transform }, i) => (
          <path
            key={i}
            d={d}
            transform={transform}
            fillRule={fillRule === 'evenodd' ? 'evenodd' : 'nonzero'}
            clipRule={fillRule === 'evenodd' ? 'evenodd' : 'nonzero'}
          />
        ))}
      </svg>
    );
  }

  if (item.id === 'dma') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size + 4}
        height={size + 4}
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        <text
          x="12.4"
          y="11.8"
          textAnchor="middle"
          fontFamily="Orbitron, sans-serif"
          fontSize="5.4"
          fontWeight="800"
          letterSpacing="0.15"
          fill="currentColor"
          stroke="none"
        >
          DMA
        </text>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={item.isPrimary ? 1.9 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {item.icon}
    </svg>
  );
}

export default function LaserSliceRail({ isOpen, onClose }) {
  const router = useRouter();
  const { push: sweepPush } = useSweepNavigate(400);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  // 'off' (unmounted) | 'in' (open / opening) | 'out' (closing animation)
  const [phase, setPhase] = useState(isOpen ? 'in' : 'off');
  const [openKey, setOpenKey] = useState(0); // bump to replay the open animation
  const [railH, setRailH] = useState(0);
  const [pendingId, setPendingId] = useState(null); // item tapped, before the route changes
  const [bar, setBar] = useState(null); // { top, height } of the active bar inside the list

  const navRef = useRef(null);
  const itemRefs = useRef({});
  const closeTimer = useRef(null);

  // Open / close lifecycle — keep mounted long enough to play the close animation.
  useEffect(() => {
    if (isOpen) {
      clearTimeout(closeTimer.current);
      setPendingId(null);
      setPhase('in');
      setOpenKey((k) => k + 1);
    } else {
      setPhase((p) => (p === 'off' ? 'off' : 'out'));
      clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(() => setPhase('off'), CLOSE_MS);
    }
  }, [isOpen]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  // Clear the tapped highlight once navigation lands.
  useEffect(() => {
    setPendingId(null);
  }, [router.pathname]);

  // Track the rail's real height so the fin shape fits any screen.
  useEffect(() => {
    if (phase === 'off') return undefined;
    const el = navRef.current;
    if (!el) return undefined;
    const update = () => setRailH(el.getBoundingClientRect().height);
    update();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
    } else {
      window.addEventListener('resize', update);
    }
    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', update);
    };
  }, [phase]);

  const isActive = useCallback(
    (href) => {
      if (href === '/techboard') return router.pathname === '/techboard';
      return router.pathname.startsWith(href);
    },
    [router.pathname],
  );

  const routeActive = NAV_ITEMS.find((item) => isActive(item.href));
  const activeId = pendingId || routeActive?.id || null;
  const activeIndex = NAV_ITEMS.findIndex((item) => item.id === activeId);
  const activeItem = activeIndex >= 0 ? NAV_ITEMS[activeIndex] : null;

  // Position the bar from the ACTUAL rendered icon, so it is always centered on it.
  useIsoLayoutEffect(() => {
    if (phase === 'off' || !activeId) {
      setBar(null);
      return;
    }
    const el = itemRefs.current[activeId];
    if (!el) return;
    const h = activeItem?.isPrimary ? DASH_BAR_H : BAR_H;
    setBar({ top: el.offsetTop + el.offsetHeight / 2 - h / 2, height: h });
  }, [activeId, activeItem, phase, railH, openKey]);

  const handleNavClick = (e, item) => {
    e.preventDefault();
    sweepPush(item.href, {
      onSweepStart: () => setPendingId(item.id),
      onBeforeNavigate: () => onClose?.(),
      prefetch: true,
    });
  };

  if (phase === 'off') return null;

  const closing = phase === 'out';
  const fin = railH > 0 ? finPath(railH) : '';
  const finEcho = railH > 0 ? finPath(railH, 9) : '';

  // Fit nine icons into whatever height we have.
  const contentH = (NAV_ITEMS.length - 1) * ICON_BOX + DASH_BOX;
  const gap = railH > 0
    ? Math.max(4, Math.min(14, (railH - END_PAD * 2 - contentH) / (NAV_ITEMS.length - 1)))
    : 10;

  const tag = activeItem
    ? `${String(activeIndex + 1).padStart(2, '0')} // ${TAGS[activeItem.id] || activeItem.name.toUpperCase()}`
    : null;

  const railBox = {
    position: 'fixed',
    right: 0,
    top: `calc(72px + env(safe-area-inset-top, 0px) + ${EDGE_INSET}px)`,
    bottom: `calc(env(safe-area-inset-bottom, 0px) + ${EDGE_INSET}px)`,
  };

  return (
    <div className={`lsr-root${closing ? ' lsr-out' : ''}`}>
      <style>{`
        .lsr-root { -webkit-tap-highlight-color: transparent; }
        .lsr-root button, .lsr-root a { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }

        @keyframes lsr-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes lsr-fade-out { from { opacity: 1 } to { opacity: 0 } }
        @keyframes lsr-laser-cut { 0% { transform: scaleY(0); opacity: 1 } 55% { transform: scaleY(1); opacity: 1 } 100% { transform: scaleY(1); opacity: 0 } }
        @keyframes lsr-spark { 0% { top: -6px; opacity: 1 } 55% { top: calc(100% - 6px); opacity: 1 } 70%, 100% { top: calc(100% - 6px); opacity: 0 } }
        @keyframes lsr-laser-close { 0% { transform: scaleY(1); opacity: 0 } 30% { opacity: 1 } 100% { transform: scaleY(0); opacity: 1 } }
        @keyframes lsr-panel-in {
          0% { transform: perspective(600px) rotateY(-88deg); opacity: 0 }
          12% { opacity: 1 }
          70% { transform: perspective(600px) rotateY(6deg) }
          100% { transform: perspective(600px) rotateY(0deg); opacity: 1 }
        }
        @keyframes lsr-panel-out {
          0% { transform: perspective(600px) rotateY(0deg); opacity: 1 }
          100% { transform: perspective(600px) rotateY(-88deg); opacity: 0 }
        }
        @keyframes lsr-icon-in { 0% { opacity: 0; translate: 16px 0; scale: 0.8 } 100% { opacity: 1; translate: 0 0; scale: 1 } }
        @keyframes lsr-scan { 0% { transform: translateY(-60px); opacity: 0 } 15% { opacity: 1 } 100% { transform: translateY(var(--lsr-h, 700px)); opacity: 0 } }
        @keyframes lsr-flicker { 0%, 92%, 96%, 100% { opacity: 1 } 94% { opacity: 0.4 } }

        .lsr-backdrop { animation: lsr-fade-in 0.3s both; }
        .lsr-root.lsr-out .lsr-backdrop { animation: lsr-fade-out 0.35s 0.1s both; }

        .lsr-laser { transform-origin: 50% 0; animation: lsr-laser-cut 0.42s cubic-bezier(0.6, 0, 0.3, 1) both; }
        .lsr-spark { animation: lsr-spark 0.42s cubic-bezier(0.6, 0, 0.3, 1) both; }
        .lsr-laser-close { transform-origin: 50% 100%; animation: lsr-laser-close 0.3s ease-in 0.15s both; }

        .lsr-panel { transform-origin: 100% 50%; animation: lsr-panel-in 0.55s cubic-bezier(0.2, 0.9, 0.25, 1) 0.2s both; }
        .lsr-root.lsr-out .lsr-panel { animation: lsr-panel-out 0.3s cubic-bezier(0.5, 0, 0.8, 0.4) both; }

        .lsr-icon { animation: lsr-icon-in 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.2) both; }
        .lsr-root.lsr-out .lsr-icon { animation: none; }
        .lsr-scanband { animation: lsr-scan 0.75s ease-out 0.6s both; }
        .lsr-edge { animation: lsr-flicker 3.2s linear 1s infinite; }

        @media (prefers-reduced-motion: reduce) {
          .lsr-root *, .lsr-root *::before, .lsr-root *::after {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
            transition-duration: 1ms !important;
          }
        }
      `}</style>

      {/* Backdrop — tap to close (same behaviour as the classic rail) */}
      <div
        className="lsr-backdrop fixed inset-0 z-[1190]"
        style={{
          background: 'radial-gradient(ellipse at 100% 50%, rgba(34,211,238,0.12), rgba(4,8,14,0.6) 55%)',
          pointerEvents: closing ? 'none' : 'auto',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Laser cut on the right screen edge (the hinge) */}
      <div key={`laser-${openKey}-${phase}`} aria-hidden="true" style={{ ...railBox, width: 12, zIndex: 1196, pointerEvents: 'none' }}>
        {closing ? (
          <div
            className="lsr-laser-close"
            style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 3, background: '#F0FFFF', boxShadow: `0 0 6px #A5F3FC, 0 0 18px ${CYAN}` }}
          />
        ) : (
          <>
            <div
              className="lsr-laser"
              style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 3, background: '#F0FFFF', boxShadow: `0 0 6px #A5F3FC, 0 0 18px ${CYAN}, 0 0 40px ${CYAN}` }}
            />
            <div
              className="lsr-spark"
              style={{ position: 'absolute', right: -5, width: 12, height: 12, borderRadius: '50%', background: '#FFFFFF', boxShadow: `0 0 10px #FFFFFF, 0 0 24px ${CYAN}, 0 0 44px ${CYAN}` }}
            />
          </>
        )}
      </div>

      {/* The panel */}
      <nav
        key={`panel-${openKey}`}
        ref={navRef}
        aria-label="Main navigation"
        className="lsr-panel"
        style={{ ...railBox, width: RAIL_W, zIndex: 1195, '--lsr-h': `${railH}px` }}
      >
        {railH > 0 && (
          <svg
            aria-hidden="true"
            width={RAIL_W}
            height={railH}
            viewBox={`0 0 ${RAIL_W} ${railH}`}
            style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
          >
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgb(16,48,66)" stopOpacity="0.97" />
                <stop offset="70%" stopColor="rgb(8,16,28)" stopOpacity="0.97" />
              </linearGradient>
              <pattern id={`${uid}-lines`} width="4" height="4" patternUnits="userSpaceOnUse">
                <rect width="4" height="1" fill={CYAN} fillOpacity="0.07" />
              </pattern>
              <pattern id={`${uid}-ticks`} width="4" height="12" patternUnits="userSpaceOnUse">
                <rect width="4" height="1" fill={CYAN} fillOpacity="0.4" />
              </pattern>
              <linearGradient id={`${uid}-scan`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#A5F3FC" stopOpacity="0" />
                <stop offset="50%" stopColor="#A5F3FC" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#A5F3FC" stopOpacity="0" />
              </linearGradient>
              <clipPath id={`${uid}-clip`}>
                <path d={`${fin} Z`} />
              </clipPath>
            </defs>

            <path d={`${fin} Z`} fill={`url(#${uid}-bg)`} />
            <g clipPath={`url(#${uid}-clip)`}>
              <rect width={RAIL_W} height={railH} fill={`url(#${uid}-lines)`} />
              <rect x={RAIL_W - 11} y="70" width="4" height={Math.max(0, railH - 140)} fill={`url(#${uid}-ticks)`} />
              {!closing && <rect className="lsr-scanband" width={RAIL_W} height="50" fill={`url(#${uid}-scan)`} />}
            </g>

            <g className="lsr-edge">
              <path d={finEcho} fill="none" stroke={CYAN} strokeOpacity="0.3" strokeWidth="1" />
              <path d={fin} fill="none" stroke={CYAN} strokeOpacity="0.35" strokeWidth="6" style={{ filter: 'blur(4px)' }} />
              <path d={fin} fill="none" stroke="#E6FFFF" strokeWidth="2" />
            </g>
          </svg>
        )}

        <div
          style={{
            position: 'relative',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap,
            paddingLeft: 10,
          }}
        >
          {/* Active bar — measured from the real icon position */}
          {bar && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 16,
                right: 6,
                top: bar.top,
                height: bar.height,
                transform: 'translateY(-2px)',
                transition: 'top 0.34s cubic-bezier(0.2, 0.8, 0.2, 1), height 0.34s cubic-bezier(0.2, 0.8, 0.2, 1)',
                borderRadius: 10,
                background: 'linear-gradient(180deg, #CFFAFE 0%, #5EEAF8 20%, #22D3EE 55%, #0891B2 100%)',
                boxShadow:
                  '0 0 0 3px rgba(8,16,28,0.92), 0 0 0 4.5px rgba(165,243,252,0.75), 0 10px 14px -4px rgba(0,0,0,0.75), 0 0 24px 2px rgba(34,211,238,0.55), inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -3px 5px rgba(3,40,56,0.45)',
              }}
            />
          )}

          {/* Orange readout tag, riding beside the bar */}
          {bar && tag && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: `calc(100% + 12px)`,
                top: bar.top + bar.height / 2 - 12,
                transition: 'top 0.34s cubic-bezier(0.2, 0.8, 0.2, 1)',
                whiteSpace: 'nowrap',
                background: '#FF8A1F',
                color: '#1A0A00',
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                lineHeight: '14px',
                padding: '5px 14px 5px 10px',
                clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)',
              }}
            >
              {tag}
            </div>
          )}

          {NAV_ITEMS.map((item, i) => {
            const active = item.id === activeId;
            const box = item.isPrimary ? DASH_BOX : ICON_BOX;
            const iconSize = item.isPrimary ? 29 : 22;
            return (
              <Link
                key={item.id}
                href={item.href}
                ref={(el) => {
                  itemRefs.current[item.id] = el;
                }}
                onClick={(e) => handleNavClick(e, item)}
                aria-label={item.name}
                aria-current={active ? 'page' : undefined}
                className="lsr-icon"
                style={{
                  position: 'relative',
                  flex: '0 0 auto',
                  width: box,
                  height: box,
                  display: 'grid',
                  placeItems: 'center',
                  animationDelay: `${0.48 + i * 0.04}s`,
                  transform: active ? 'translateY(-2px)' : 'translateY(0)',
                  color: active ? ACTIVE_ICON : item.isPrimary ? IDLE_DASH : IDLE_ICON,
                  filter: active ? 'drop-shadow(0 1px 0 rgba(255,255,255,0.45))' : 'none',
                  transition: 'transform 0.34s cubic-bezier(0.2, 0.8, 0.2, 1), color 0.25s',
                }}
              >
                <RailIcon item={item} size={iconSize} />
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
